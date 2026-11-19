import { GoogleGenAI } from "@google/genai";
import config from "./config.js";
import log, { redact } from "./log.js";
import { AUTO, languageName } from "./languages.js";

let client = null;
let stubClient = null;
function ai() {
  if (stubClient) return stubClient;
  if (!config.geminiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiKey });
  return client;
}

export function geminiConfigured() {
  return Boolean(stubClient || config.geminiKey);
}

export class GeminiError extends Error {
  constructor(kind, message, { status, retryAfterMs = 0 } = {}) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

// After a 429, an auth failure or a missing model, skip Gemini for a while
// instead of paying its latency on every utterance just to fall back again.
let coolUntil = 0;
let coolReason = null;
// Set after a 400 on the full request: retry without schema/thinking config.
let minimalConfig = false;
const health = { lastOkAt: null, lastError: null, lastModel: null };

const modelChain = () => [config.geminiModel, ...config.geminiFallbackModels.filter((m) => m !== config.geminiModel)];

export function geminiCoolingDown() {
  return Date.now() < coolUntil ? coolReason : null;
}

export function geminiHealth() {
  return {
    configured: geminiConfigured(),
    model: config.geminiModel,
    fallbackModels: modelChain().slice(1),
    lastModel: health.lastModel,
    coolingDown: geminiCoolingDown(),
    minimalConfig,
    lastOkAt: health.lastOkAt,
    lastError: health.lastError,
  };
}

export function setGeminiClientForTests(fake) {
  stubClient = fake;
  coolUntil = 0;
  coolReason = null;
  minimalConfig = false;
  health.lastOkAt = null;
  health.lastError = null;
  health.lastModel = null;
}

const COOLDOWN = { auth: 10 * 60_000, model: 10 * 60_000 };

function classify(err) {
  if (err instanceof GeminiError) return err;
  if (err?.name === "AbortError") return new GeminiError("timeout", "Gemini timed out");
  const status = Number(err?.status) || undefined;
  const message = redact(err?.message || "Gemini request failed").slice(0, 300);
  if (status === 429) {
    const m = /retry in ([\d.]+)s/i.exec(message);
    return new GeminiError("rate_limited", message, { status, retryAfterMs: m ? Math.ceil(Number(m[1]) * 1000) : 30_000 });
  }
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(message)) {
    return new GeminiError("auth", "Gemini rejected the API key", { status, retryAfterMs: COOLDOWN.auth });
  }
  if (status === 404) {
    return new GeminiError("model", "Model was not found", { status, retryAfterMs: COOLDOWN.model });
  }
  if (status === 400) return new GeminiError("invalid_request", message, { status });
  return new GeminiError("error", message, { status });
}

function thinkingConfig() {
  const level = config.geminiThinkingLevel;
  if (!level || level === "OFF" || level === "DEFAULT") return undefined;
  return { thinkingLevel: level };
}

function parseJsonLoose(text) {
  const raw = String(text ?? "").trim();
  if (!raw) throw new GeminiError("bad_output", "Gemini returned no text");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  try {
    const value = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
    if (!value || typeof value !== "object") throw new Error("not an object");
    return value;
  } catch {
    throw new GeminiError("bad_output", "Gemini returned non-JSON output");
  }
}

async function callOnce(c, { system, prompt, schema }, minimal, deadline, model) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new GeminiError("timeout", "Gemini timed out");
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new GeminiError("timeout", "Gemini timed out"));
    }, remaining);
  });
  const base = { abortSignal: controller.signal, httpOptions: { timeout: remaining } };
  const request = c.models.generateContent({
    model,
    contents: prompt,
    config: minimal
      ? { ...base, systemInstruction: `${system} Reply with only a JSON object shaped like this JSON Schema: ${JSON.stringify(schema)}` }
      : {
          ...base,
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          thinkingConfig: thinkingConfig(),
        },
  });
  try {
    const response = await Promise.race([request, timeout]);
    return response?.text;
  } finally {
    clearTimeout(timer);
    request.catch(() => undefined);
  }
}

async function generateJson({ system, prompt, schema, timeoutMs, kind }) {
  const c = ai();
  if (!c) throw new GeminiError("unconfigured", "GEMINI_API_KEY is not set");
  if (geminiCoolingDown()) throw new GeminiError("cooling_down", "Gemini is cooling down");

  const started = Date.now();
  const deadline = started + timeoutMs;
  const req = { system, prompt, schema };
  const attempt = async (model) => {
    try {
      return await callOnce(c, req, minimalConfig, deadline, model);
    } catch (err) {
      const e = classify(err);
      if (e.kind !== "invalid_request" || minimalConfig) throw e;
      minimalConfig = true;
      log.warn("gemini_minimal_config", { model, error: e.message });
      return callOnce(c, req, true, deadline, model);
    }
  };

  const chain = modelChain();
  try {
    let text;
    for (let i = 0; ; i++) {
      try {
        text = await attempt(chain[i]);
        health.lastModel = chain[i];
        break;
      } catch (err) {
        const e = classify(err);
        // Another model may be up when this one is overloaded, throttled or not served on this key.
        const retryable = e.status === 429 || e.status === 404 || (e.status >= 500 && e.status < 600);
        if (!retryable || i === chain.length - 1 || Date.now() >= deadline) throw e;
        log.warn("gemini_model_unavailable", { kind, model: chain[i], next: chain[i + 1], status: e.status });
      }
    }
    const value = parseJsonLoose(text);
    health.lastOkAt = new Date().toISOString();
    log.info("gemini_ok", { kind, model: health.lastModel, ms: Date.now() - started, minimal: minimalConfig });
    return value;
  } catch (err) {
    const e = classify(err);
    if (e.retryAfterMs) {
      coolUntil = Date.now() + e.retryAfterMs;
      coolReason = e.kind;
    }
    health.lastError = { kind: e.kind, status: e.status, at: new Date().toISOString() };
    log.warn("gemini_failed", { kind, models: chain.join(","), ms: Date.now() - started, reason: e.kind, status: e.status, error: e.message });
    throw e;
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
