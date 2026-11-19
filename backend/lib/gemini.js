import { GoogleGenAI } from "@google/genai";
import config from "./config.js";
import log, { redact } from "./log.js";
import { AUTO, languageName } from "./languages.js";

let client = null;
function ai() {
  if (!config.geminiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiKey });
  return client;
}

export function geminiConfigured() {
  return Boolean(config.geminiKey);
}

export class GeminiError extends Error {
  constructor(kind, message, retryAfterMs = 0) {
    super(message);
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

// After a 429 or an auth failure, skip Gemini for a while instead of paying
// its latency on every utterance just to fall back again.
let coolUntil = 0;
let coolReason = null;
export function geminiCoolingDown() {
  return Date.now() < coolUntil ? coolReason : null;
}

function classify(err, timedOut) {
  if (timedOut || err?.name === "AbortError") return new GeminiError("timeout", "Gemini timed out");
  const status = err?.status;
  const message = redact(err?.message || "Gemini request failed").slice(0, 300);
  if (status === 429) {
    const m = /retry in ([\d.]+)s/i.exec(message);
    const retryAfterMs = m ? Math.ceil(Number(m[1]) * 1000) : 30_000;
    return new GeminiError("rate_limited", message, retryAfterMs);
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(message)) {
    return new GeminiError("auth", "Gemini rejected the API key", 10 * 60_000);
  }
  return new GeminiError("error", message);
}

function thinkingConfig() {
  const level = config.geminiThinkingLevel;
  if (!level || level === "OFF" || level === "DEFAULT") return undefined;
  return { thinkingLevel: level };
}

async function generateJson({ system, prompt, schema, timeoutMs, kind }) {
  const c = ai();
  if (!c) throw new GeminiError("unconfigured", "GEMINI_API_KEY is not set");
  if (geminiCoolingDown()) throw new GeminiError("cooling_down", "Gemini is cooling down", coolUntil - Date.now());

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const started = Date.now();

  try {
    const response = await c.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        thinkingConfig: thinkingConfig(),
        abortSignal: controller.signal,
        httpOptions: { timeout: timeoutMs },
      },
    });
    const text = response.text ?? "";
    log.info("gemini_ok", { kind, model: config.geminiModel, ms: Date.now() - started });
    try {
      return JSON.parse(text);
    } catch {
      throw new GeminiError("bad_output", "Gemini returned non-JSON output");
    }
  } catch (err) {
    const e = err instanceof GeminiError ? err : classify(err, timedOut);
    if (e.kind === "rate_limited" || e.kind === "auth") {
      coolUntil = Date.now() + e.retryAfterMs;
      coolReason = e.kind;
    }
    log.warn("gemini_failed", { kind, model: config.geminiModel, ms: Date.now() - started, reason: e.kind, error: e.message });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const TONES = {
  casual: "casual and conversational, like a friend talking",
  formal: "formal and polite, suitable for business",
};

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    translation: { type: "string" },
    source_language: { type: "string", description: "ISO 639-1 code of the CURRENT utterance" },
  },
  required: ["translation", "source_language"],
};

/**
 * Translates `text` using the previous turns as context.
 * context: [{ original, translated }] oldest first.
 */
export async function geminiTranslate({ text, sourceLang, targetLang, tone, context = [] }) {
  const from = sourceLang === AUTO ? "whatever language the speaker uses (detect it)" : languageName(sourceLang);
  const system = [
    `You are a live interpreter translating speech from ${from} into ${languageName(targetLang)}.`,
    "Translate only the CURRENT utterance. Earlier turns are context: use them to resolve pronouns, gender, tone and references, never translate or repeat them.",
    "Render idioms with natural equivalents, keep names and numbers, fix obvious speech-recognition slips, and do not add explanations.",
    `Register: ${TONES[tone] || TONES.casual}.`,
  ].join(" ");

  const history = context
    .slice(-config.contextTurns)
    .map((t, i) => `${i + 1}. ${t.original} => ${t.translated}`)
    .join("\n");
  const prompt = `${history ? `Earlier turns:\n${history}\n\n` : ""}CURRENT: ${text}`;

  const out = await generateJson({
    system,
    prompt,
    schema: TRANSLATION_SCHEMA,
    timeoutMs: config.translateTimeoutMs,
    kind: "translate",
  });
  const translated = typeof out.translation === "string" ? out.translation.trim() : "";
  if (!translated) throw new GeminiError("bad_output", "Gemini returned an empty translation");
  const detected = typeof out.source_language === "string" ? out.source_language.trim().toLowerCase() : "";
  return { translated, detectedLang: /^[a-z]{2,3}$/.test(detected) ? detected : undefined };
}

const SIDE = {
  type: "object",
  properties: {
    summary: { type: "string" },
    action_items: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "action_items"],
};

const SUMMARY_SCHEMA = {
  type: "object",
  properties: { source: SIDE, target: SIDE },
  required: ["source", "target"],
};

function cleanSide(side) {
  return {
    summary: typeof side?.summary === "string" ? side.summary.trim() : "",
    actionItems: Array.isArray(side?.action_items)
      ? side.action_items.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
      : [],
  };
}

/**
 * utterances: [{ original, translated }] oldest first.
 */
export async function geminiSummarize({ utterances, sourceLang, targetLang }) {
  const sourceName = sourceLang === AUTO ? "the language most of the conversation was spoken in" : languageName(sourceLang);
  const targetName = languageName(targetLang);
  const system = [
    "You summarize a live, machine-translated conversation.",
    "Write a concise summary (2-4 sentences) and a list of concrete action items or decisions (include who, and when, if stated; return an empty list if there are none).",
    `Write the "source" object in ${sourceName} and the "target" object in ${targetName}. Both must say the same thing.`,
    "Use only what was said; do not invent details.",
  ].join(" ");

  const lines = [];
  let budget = config.maxSummaryChars;
  for (let i = utterances.length - 1; i >= 0 && budget > 0; i--) {
    const u = utterances[i];
    const line = `${i + 1}. ${u.original}${u.translated ? ` (${u.translated})` : ""}`;
    budget -= line.length;
    if (budget >= 0) lines.unshift(line);
  }

  const out = await generateJson({
    system,
    prompt: `Conversation (original, with translation in brackets):\n${lines.join("\n")}`,
    schema: SUMMARY_SCHEMA,
    timeoutMs: config.summaryTimeoutMs,
    kind: "summary",
  });
  const result = { source: cleanSide(out.source), target: cleanSide(out.target) };
  if (!result.source.summary && !result.target.summary) throw new GeminiError("bad_output", "Gemini returned an empty summary");
  return result;
}
