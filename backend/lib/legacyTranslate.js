import axios from "axios";
import log from "./log.js";
import { baseCode, googleCode } from "./languages.js";

const TIMEOUT = 5000;
const CACHE_MAX = 500;
const cache = new Map();
const libreUrl = process.env.LIBRETRANSLATE_URL?.trim();
const libreKey = process.env.LIBRETRANSLATE_API_KEY?.trim();

function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

async function googleGtx(text, sourceLang, targetLang) {
  const { data } = await axios.get("https://translate.googleapis.com/translate_a/single", {
    params: { client: "gtx", sl: googleCode(sourceLang), tl: googleCode(targetLang), dt: "t", q: text },
    timeout: TIMEOUT,
  });
  return {
    translated: data[0].map((part) => part[0]).join(""),
    detectedLang: typeof data[2] === "string" ? data[2] : undefined,
  };
}

// Second unofficial Google endpoint; it is rate-limited separately from gtx.
async function googleDict(text, sourceLang, targetLang) {
  const { data } = await axios.get("https://clients5.google.com/translate_a/t", {
    params: { client: "dict-chrome-ex", sl: googleCode(sourceLang), tl: googleCode(targetLang), q: text },
    timeout: TIMEOUT,
  });
  const first = data[0];
  return Array.isArray(first)
    ? { translated: first[0], detectedLang: first[1] }
    : { translated: first };
}

async function myMemory(text, sourceLang, targetLang) {
  const from = sourceLang === "auto" ? "autodetect" : googleCode(sourceLang);
  const { data } = await axios.get("https://api.mymemory.translated.net/get", {
    params: { q: text, langpair: `${from}|${googleCode(targetLang)}` },
    timeout: TIMEOUT,
  });
  if (data.responseStatus !== 200 || data.quotaFinished) throw new Error(`status ${data.responseStatus}`);
  return { translated: data.responseData?.translatedText, detectedLang: data.responseData?.detectedLanguage };
}

async function libre(text, sourceLang, targetLang) {
  const { data } = await axios.post(
    `${libreUrl.replace(/\/$/, "")}/translate`,
    { q: text, source: sourceLang === "auto" ? "auto" : baseCode(sourceLang), target: baseCode(targetLang), api_key: libreKey },
    { timeout: TIMEOUT }
  );
  return { translated: data.translatedText, detectedLang: data.detectedLanguage?.language };
}

const downUntil = new Map();
const providers = [
  ["google", googleGtx],
  ["google", googleDict],
  ["mymemory", myMemory],
  ...(libreUrl ? [["libre", libre]] : []),
];

/**
 * Sentence-level machine translation without context. Never throws: when every
 * provider fails it returns the original text with engine "none".
 */
export async function legacyTranslate(text, sourceLang, targetLang) {
  const key = `${sourceLang}\u0000${targetLang}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  for (const [engine, fn] of providers) {
    if (Date.now() < (downUntil.get(fn) || 0)) continue;
    const started = Date.now();
    try {
      const { translated, detectedLang } = await fn(text, sourceLang, targetLang);
      if (typeof translated !== "string" || !translated.trim()) throw new Error("empty response");
      const result = { translated: translated.trim(), engine, detectedLang: detectedLang ? baseCode(detectedLang) : undefined };
      remember(key, result);
      log.info("legacy_translate", { engine, ms: Date.now() - started, chars: text.length });
      return result;
    } catch (err) {
      // These endpoints throttle by IP; skip a throttled one for a while.
      if (err.response?.status === 429) downUntil.set(fn, Date.now() + 5 * 60_000);
      log.warn("legacy_translate_failed", { engine, provider: fn.name, ms: Date.now() - started, error: err.message });
    }
  }
  return { translated: text, engine: "none" };
}
