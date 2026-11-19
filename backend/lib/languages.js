const displayNames = new Intl.DisplayNames(["en"], { type: "language" });

export const AUTO = "auto";

const CODE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/;

export function isLanguageCode(code) {
  return code === AUTO || (typeof code === "string" && CODE_RE.test(code));
}

export function languageName(code) {
  if (!code || code === AUTO) return "the speaker's language";
  try {
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

export function baseCode(code) {
  return String(code || "").split("-")[0].toLowerCase();
}

// Codes the unofficial Google endpoint expects: Chinese keeps its script variant.
export function googleCode(code) {
  if (!code || code === AUTO) return "auto";
  if (code === "zh-TW" || code === "zh-HK" || code === "zh-Hant") return "zh-TW";
  if (code === "zh" || code === "zh-CN" || code === "zh-Hans") return "zh-CN";
  return baseCode(code);
}

// https://developers.deepgram.com/docs/models-languages-overview (checked 2026-11)
const NOVA3 = new Set(
  "af ar be bn bs bg ca zh-HK zh zh-CN zh-Hans hr cs da nl en en-US en-GB en-AU en-NZ en-IN en-CA et fi nl-BE fr gl de el gu he hi hu id it ja kn ko lv lt mk ms mr no fa pl pt ro ru sr sk sl es sv tl ta te th tr uk vi xh zu".split(" ")
);
const NOVA2 = new Set(
  "bg ca zh zh-CN zh-Hans zh-TW zh-Hant zh-HK cs da da-DK nl en en-US en-AU en-GB en-NZ en-IN et fi nl-BE fr fr-CA de de-CH el hi hu id it ja ko ko-KR lv lt ms no pl pt pt-BR pt-PT ro ru sk es es-419 sv sv-SE th th-TH tr uk vi".split(" ")
);

/**
 * Picks the Deepgram model + language for a requested source language.
 * Returns null when no streaming model supports it.
 */
export function resolveSttLanguage(code) {
  if (code === AUTO) return { model: "nova-3", language: "multi" };
  if (NOVA3.has(code)) return { model: "nova-3", language: code };
  if (NOVA2.has(code)) return { model: "nova-2", language: code };
  const base = baseCode(code);
  if (NOVA3.has(base)) return { model: "nova-3", language: base };
  if (NOVA2.has(base)) return { model: "nova-2", language: base };
  return null;
}

// The language codes the original server passed straight to Deepgram
// (standard mode). Anything else falls back to English, as before.
const STANDARD_STT = new Set(
  (
    "en es fr de it pt ru zh ja ko ar hi bn ur th tr vi nl pl sv da no fi cs hu ro bg hr sk sl et lv lt el mt ga cy is mk sq be uk sr bs ca gl eu af hy ka az kk uz tg mn my km lo id ms tl jw ne si ta te kn ml " +
    "en-US en-GB en-AU en-NZ en-IN es-ES es-MX pt-BR pt-PT fr-FR fr-CA de-DE de-AT it-IT ru-RU zh-CN zh-TW ja-JP ko-KR ar-SA hi-IN bn-IN ur-PK th-TH tr-TR vi-VN nl-NL pl-PL sv-SE da-DK no-NO fi-FI cs-CZ hu-HU ro-RO bg-BG hr-HR sk-SK sl-SI et-EE lv-LV lt-LT el-GR mt-MT ga-IE cy-GB is-IS mk-MK sq-AL be-BY uk-UA sr-RS bs-BA ca-ES gl-ES eu-ES af-ZA hy-AM ka-GE az-AZ kk-KZ uz-UZ tg-TJ mn-MN my-MM km-KH lo-LA id-ID ms-MY tl-PH jw-ID ne-NP si-LK ta-IN te-IN kn-IN ml-IN"
  ).split(" ")
);

export function standardSttLanguage(code) {
  return STANDARD_STT.has(code) ? code : "en";
}
