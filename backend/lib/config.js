import dotenv from "dotenv";

dotenv.config();

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function str(name, fallback = "") {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === "" ? fallback : raw.trim();
}

const config = {
  port: int("PORT", 5000),
  production: process.env.NODE_ENV === "production" || Boolean(process.env.RENDER),
  // Render terminates TLS and appends the client address to X-Forwarded-For.
  trustProxy: str("TRUST_PROXY", process.env.RENDER ? "1" : "0") === "1",
  allowedOrigins: str("ALLOWED_ORIGINS")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  deepgramKey: str("DEEPGRAM_API_KEY"),
  deepgramUrl: str("DEEPGRAM_WS_URL", "wss://api.deepgram.com/v1/listen"),
  // "standard" keeps the original Deepgram request; "enhanced" opts into
  // nova-3/nova-2, interim results, sentence grouping and language=multi.
  deepgramMode: str("DEEPGRAM_MODE", "standard") === "enhanced" ? "enhanced" : "standard",
  maxSessionMinutes: int("MAX_SESSION_MINUTES", 10),
  maxSocketsPerIp: int("MAX_SOCKETS_PER_IP", 3),

  geminiKey: str("GEMINI_API_KEY"),
  geminiModel: str("GEMINI_MODEL", "gemini-3.8-flash"),
  // Tried in order when a model is overloaded, rate-limited or missing on this key.
  geminiFallbackModels: str("GEMINI_FALLBACK_MODELS", "gemini-3.6-flash,gemini-3.5-flash-lite")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  geminiThinkingLevel: str("GEMINI_THINKING_LEVEL", "LOW").toUpperCase(),
  translateTimeoutMs: int("GEMINI_TIMEOUT_MS", 5000),
  summaryTimeoutMs: int("GEMINI_SUMMARY_TIMEOUT_MS", 20000),
  contextTurns: int("TRANSLATION_CONTEXT_TURNS", 3),

  limits: {
    aiTranslatePerMinute: int("AI_TRANSLATE_PER_MIN", 20),
    aiTranslatePerDay: int("AI_TRANSLATE_PER_DAY", 300),
    aiSummaryPerHour: int("AI_SUMMARY_PER_HOUR", 6),
    aiGlobalPerMinute: int("AI_GLOBAL_PER_MIN", 30),
    aiGlobalPerDay: int("AI_DAILY_CAP", 1000),
    httpTranslatePerMinute: int("TRANSLATE_PER_MIN", 40),
  },

  maxTextChars: 1000,
  maxSummaryChars: 12000,
};

export default config;
