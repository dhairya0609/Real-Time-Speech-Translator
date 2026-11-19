import { WebSocket } from "ws";
import config from "./config.js";
import log from "./log.js";
import { translate } from "./translator.js";
import { AUTO, isLanguageCode, languageName, resolveSttLanguage, standardSttLanguage } from "./languages.js";

const TONES = new Set(["casual", "formal"]);
const HISTORY = 6;

// The request the original server made; kept as the default because it is the
// only one verified against the live Deepgram account.
function standardUrl(language) {
  return `${config.deepgramUrl}?punctuate=true&language=${encodeURIComponent(language)}&utterances=true&sample_rate=48000&channels=1`;
}

function enhancedUrl({ model, language }) {
  const params = new URLSearchParams({
    model,
    language,
    punctuate: "true",
    smart_format: "true",
    interim_results: "true",
    utterance_end_ms: "1000",
    endpointing: "300",
  });
  return `${config.deepgramUrl}?${params}`;
}

function topLanguage(counts) {
  let best;
  let max = 0;
  for (const [lang, n] of counts) if (n > max) [best, max] = [lang, n];
  return best;
}

/**
 * One browser WebSocket = one session: relays audio to Deepgram, groups
 * finalized segments into utterances, and translates each utterance with the
 * session's recent history as context.
 */
export class LiveSession {
  constructor(ws, ip) {
    this.ws = ws;
    this.ip = ip;
    this.sourceLang = "en";
    this.targetLang = "es";
    this.tone = "casual";
    this.dg = null;
    this.ready = false;
    this.segments = [];
    this.wordLangs = new Map();
    this.history = [];
    this.nextId = 1;
    this.sessionTimer = null;
    this.keepAlive = null;
    this.stopping = false;

    ws.on("message", (data, isBinary) => this.onMessage(data, isBinary));
    ws.on("close", () => this.teardown());
    ws.on("error", (err) => log.warn("client_socket_error", { error: err.message }));
  }

  send(payload) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  fail(code, message) {
    this.send({ type: "error", code, message });
  }

  applySettings(data) {
    if (isLanguageCode(data.sourceLang)) this.sourceLang = data.sourceLang;
    if (isLanguageCode(data.targetLang) && data.targetLang !== AUTO) this.targetLang = data.targetLang;
    if (TONES.has(data.tone)) this.tone = data.tone;
  }

  onMessage(data, isBinary) {
    if (isBinary) {
      if (this.dg && this.ready && this.dg.readyState === WebSocket.OPEN) this.dg.send(data);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return this.fail("bad_message", "Something went wrong. Try again.");
    }

    switch (msg.type) {
      case "start":
        this.applySettings(msg);
        return this.start();
      case "settings":
        this.applySettings({ targetLang: msg.targetLang, tone: msg.tone });
        return undefined;
      case "stop":
        return this.stop();
      case "ping":
        return this.send({ type: "pong" });
      default:
        return this.fail("bad_message", "Something went wrong. Try again.");
    }
  }

  start() {
    if (this.dg) this.closeDeepgram();
    if (!config.deepgramKey) {
      return this.fail("stt_unconfigured", "Voice input isn't available right now. You can still type.");
    }
    let url;
    let sttLabel;
    this.enhanced = config.deepgramMode === "enhanced";
    if (this.enhanced) {
      const stt = resolveSttLanguage(this.sourceLang);
      if (!stt) {
        return this.fail("stt_language", "Voice input doesn't support this language yet. Type instead, or pick another language.");
      }
      url = enhancedUrl(stt);
      sttLabel = stt;
    } else {
      const language = standardSttLanguage(this.sourceLang);
      if (language !== this.sourceLang) {
        this.send({
          type: "notice",
          code: "stt_language_fallback",
          message:
            this.sourceLang === AUTO
              ? "Listening for English. Automatic language detection works for typed text."
              : `Voice input doesn't support ${languageName(this.sourceLang)} yet, so it's listening for English. Typing works in any language.`,
        });
      }
      this.sttLang = language;
      url = standardUrl(language);
      sttLabel = { model: "default", language };
    }

    this.stopping = false;
    this.segments = [];
    this.wordLangs = new Map();
    const dg = new WebSocket(url, { headers: { Authorization: `Token ${config.deepgramKey}` } });
    this.dg = dg;
    const started = Date.now();

    dg.on("open", () => {
      if (this.dg !== dg) return;
      this.ready = true;
      log.info("stt_open", { mode: config.deepgramMode, model: sttLabel.model, language: sttLabel.language, ms: Date.now() - started });
      this.send({ type: "ready", mode: config.deepgramMode, autoDetect: sttLabel.language === "multi" });
      this.keepAlive = setInterval(() => {
        if (dg.readyState === WebSocket.OPEN) dg.send(JSON.stringify({ type: "KeepAlive" }));
      }, 8000);
      this.sessionTimer = setTimeout(() => {
        this.send({ type: "session_end", reason: "time_limit", minutes: config.maxSessionMinutes });
        this.stop();
      }, config.maxSessionMinutes * 60_000);
    });

    dg.on("message", (raw) => {
      if (this.dg !== dg) return;
      try {
        this.onDeepgram(JSON.parse(raw.toString()));
      } catch (err) {
        log.warn("stt_parse_failed", { error: err.message });
      }
    });

    dg.on("error", (err) => {
      const status = Number(/Unexpected server response: (\d+)/.exec(err.message)?.[1]);
      log.error("stt_error", { status: status || undefined, error: err.message });
      if (this.dg !== dg || this.stopping) return;
      if (status === 401 || status === 403) this.fail("stt_auth", "Voice input is temporarily unavailable. You can still type.");
      else if (status === 402) this.fail("stt_quota", "Voice input is temporarily unavailable. You can still type.");
      else if (status === 400) this.fail("stt_language", "Voice input doesn't support this language yet. Type instead, or pick another language.");
      else this.fail("stt_failed", "Voice input is temporarily unavailable. Try again in a moment.");
    });

    dg.on("close", () => {
      if (this.dg !== dg) return;
      this.flushUtterance();
      this.clearTimers();
      this.dg = null;
      this.ready = false;
      this.send({ type: "stopped" });
    });
  }

  onDeepgram(msg) {
    if (msg.type === "UtteranceEnd") return this.flushUtterance();
    if (msg.type && msg.type !== "Results") return undefined;

    const alt = msg.channel?.alternatives?.[0];
    const text = (alt?.transcript || "").trim();

    if (!this.enhanced) {
      // Original behaviour: every final result is its own utterance.
      if (!text) return undefined;
      if (!msg.is_final) return this.send({ type: "transcript", text, isFinal: false });
      this.segments.push(text);
      return this.flushUtterance();
    }

    if (msg.is_final) {
      if (text) {
        this.segments.push(text);
        for (const w of alt.words || []) {
          if (w.language) this.wordLangs.set(w.language, (this.wordLangs.get(w.language) || 0) + 1);
        }
        if (!alt.words?.some((w) => w.language) && Array.isArray(alt.languages) && alt.languages[0]) {
          this.wordLangs.set(alt.languages[0], (this.wordLangs.get(alt.languages[0]) || 0) + 1);
        }
      }
      if (msg.speech_final) return this.flushUtterance();
      if (this.segments.length) this.send({ type: "transcript", text: this.segments.join(" "), isFinal: false });
      return undefined;
    }

    if (text) this.send({ type: "transcript", text: [...this.segments, text].join(" "), isFinal: false });
    return undefined;
  }

  flushUtterance() {
    if (!this.segments.length) return;
    const text = this.segments.join(" ").trim();
    const detectedLang = topLanguage(this.wordLangs);
    this.segments = [];
    this.wordLangs = new Map();
    if (!text) return;

    const id = `v${this.nextId++}`;
    this.send({ type: "utterance", id, text, detectedLang });
    this.translateUtterance(id, text, detectedLang);
  }

  async translateUtterance(id, text, detectedLang) {
    const sourceLang = this.enhanced
      ? this.sourceLang === AUTO && detectedLang
        ? detectedLang
        : this.sourceLang
      : this.sttLang;
    try {
      const r = await translate({
        text,
        sourceLang,
        targetLang: this.targetLang,
        tone: this.tone,
        context: this.history,
        ip: this.ip,
      });
      this.history.push({ original: text, translated: r.translated });
      if (this.history.length > HISTORY) this.history.shift();
      this.send({
        type: "translation",
        id,
        translated: r.translated,
        romanized: r.romanized,
        engine: r.engine,
        model: r.model,
        detectedLang: detectedLang || r.detectedLang,
        targetLang: this.targetLang,
        notice: r.notice,
      });
    } catch (err) {
      log.error("translate_unexpected", { error: err.message });
      this.send({ type: "translation", id, translated: "", engine: "none", notice: "translation_failed" });
    }
  }

  stop() {
    if (!this.dg) return this.send({ type: "stopped" });
    if (this.stopping) return undefined;
    this.stopping = true;
    const dg = this.dg;
    if (dg.readyState === WebSocket.OPEN) {
      // CloseStream makes Deepgram flush pending finals before closing.
      dg.send(JSON.stringify({ type: "CloseStream" }));
      setTimeout(() => {
        if (this.dg === dg) dg.close();
      }, 3000).unref();
    } else {
      dg.terminate();
    }
    return undefined;
  }

  clearTimers() {
    clearInterval(this.keepAlive);
    clearTimeout(this.sessionTimer);
    this.keepAlive = null;
    this.sessionTimer = null;
  }

  closeDeepgram() {
    const dg = this.dg;
    this.dg = null;
    this.ready = false;
    this.clearTimers();
    if (dg) {
      try {
        if (dg.readyState === WebSocket.OPEN) dg.close();
        else dg.terminate();
      } catch {
        /* socket already gone */
      }
    }
  }

  teardown() {
    this.closeDeepgram();
  }
}
