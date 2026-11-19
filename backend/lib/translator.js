import config from "./config.js";
import { geminiConfigured, geminiCoolingDown, geminiTranslate } from "./gemini.js";
import { legacyTranslate } from "./legacyTranslate.js";
import { reserveAiCall } from "./rateLimit.js";
import { AUTO, baseCode } from "./languages.js";

const FALLBACK_NOTICE = {
  unconfigured: "ai_unconfigured",
  rate_limited: "ai_rate_limited",
  auth: "ai_error",
  timeout: "ai_timeout",
  bad_output: "ai_error",
  error: "ai_error",
};

/**
 * Gemini with conversation context first; the legacy Google/Libre path when
 * Gemini is unconfigured, rate-limited, slow or failing.
 * Returns { translated, engine, detectedLang?, notice? }.
 */
export async function translate({ text, sourceLang, targetLang, tone, context, ip }) {
  if (sourceLang !== AUTO && baseCode(sourceLang) === baseCode(targetLang)) {
    return { translated: text, engine: "same", detectedLang: sourceLang };
  }

  let notice;
  if (!geminiConfigured()) {
    notice = FALLBACK_NOTICE.unconfigured;
  } else if (geminiCoolingDown()) {
    notice = FALLBACK_NOTICE[geminiCoolingDown()];
  } else {
    const slot = reserveAiCall("translate", ip);
    if (!slot.ok) {
      notice = slot.reason;
    } else {
      try {
        const r = await geminiTranslate({ text, sourceLang, targetLang, tone, context });
        return { ...r, engine: "gemini", model: config.geminiModel };
      } catch (err) {
        notice = FALLBACK_NOTICE[err.kind] || "ai_error";
      }
    }
  }

  const legacy = await legacyTranslate(text, sourceLang, targetLang);
  return { ...legacy, notice: legacy.engine === "none" ? "translation_failed" : notice };
}
