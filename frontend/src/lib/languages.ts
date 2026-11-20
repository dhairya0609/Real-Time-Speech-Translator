export const AUTO = "auto";

type Language = { code: string; name: string };

export const LANGUAGES: Language[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "ur", name: "Urdu" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "ne", name: "Nepali" },
  { code: "si", name: "Sinhala" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "vi", name: "Vietnamese" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
  { code: "tl", name: "Filipino" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "no", name: "Norwegian" },
  { code: "fi", name: "Finnish" },
  { code: "cs", name: "Czech" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "hu", name: "Hungarian" },
  { code: "ro", name: "Romanian" },
  { code: "bg", name: "Bulgarian" },
  { code: "hr", name: "Croatian" },
  { code: "sr", name: "Serbian" },
  { code: "bs", name: "Bosnian" },
  { code: "mk", name: "Macedonian" },
  { code: "sq", name: "Albanian" },
  { code: "el", name: "Greek" },
  { code: "uk", name: "Ukrainian" },
  { code: "be", name: "Belarusian" },
  { code: "et", name: "Estonian" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "he", name: "Hebrew" },
  { code: "fa", name: "Persian" },
  { code: "ca", name: "Catalan" },
  { code: "gl", name: "Galician" },
  { code: "eu", name: "Basque" },
  { code: "ga", name: "Irish" },
  { code: "cy", name: "Welsh" },
  { code: "is", name: "Icelandic" },
  { code: "mt", name: "Maltese" },
  { code: "af", name: "Afrikaans" },
  { code: "sw", name: "Swahili" },
  { code: "zu", name: "Zulu" },
  { code: "xh", name: "Xhosa" },
  { code: "hy", name: "Armenian" },
  { code: "ka", name: "Georgian" },
  { code: "az", name: "Azerbaijani" },
  { code: "kk", name: "Kazakh" },
  { code: "uz", name: "Uzbek" },
  { code: "mn", name: "Mongolian" },
  { code: "my", name: "Burmese" },
  { code: "km", name: "Khmer" },
  { code: "lo", name: "Lao" },
  { code: "jw", name: "Javanese" },
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "en-IN", name: "English (India)" },
  { code: "en-AU", name: "English (Australia)" },
  { code: "es-419", name: "Spanish (Latin America)" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "fr-CA", name: "French (Canada)" },
];

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));
let displayNames: Intl.DisplayNames | null = null;
try {
  displayNames = new Intl.DisplayNames(["en"], { type: "language" });
} catch {
  displayNames = null;
}

export function languageName(code?: string) {
  if (!code) return "";
  if (code === AUTO) return "Auto-detect";
  const known = byCode.get(code);
  if (known) return known.name;
  try {
    return displayNames?.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function shortCode(code?: string) {
  if (!code || code === AUTO) return "AUTO";
  return code.split("-")[0].toUpperCase();
}


export function bcp47(code: string) {
  return code === "zh" ? "zh-CN" : code === "jw" ? "jv" : code;
}
