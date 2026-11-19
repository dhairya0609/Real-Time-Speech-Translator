import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import config from "./lib/config.js";
import log from "./lib/log.js";
import { LiveSession } from "./lib/liveSession.js";
import { translate } from "./lib/translator.js";
import { geminiConfigured, geminiCoolingDown, geminiHealth, geminiSummarize } from "./lib/gemini.js";
import { clientIp, limiters, reserveAiCall } from "./lib/rateLimit.js";
import { AUTO, isLanguageCode } from "./lib/languages.js";

const app = express();
const server = http.createServer(app);

if (config.trustProxy) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cors(config.allowedOrigins.length ? { origin: config.allowedOrigins } : undefined));
app.use(express.json({ limit: "64kb" }));

function bad(res, message) {
  return res.status(400).json({ error: "bad_request", message });
}

function cleanText(value, max) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function cleanTurns(value, maxTurns, maxChars) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-maxTurns)
    .map((t) => ({ original: cleanText(t?.original, maxChars), translated: cleanText(t?.translated, maxChars) }))
    .filter((t) => t.original);
}

const route = (handler) => (req, res) =>
  handler(req, res).catch((err) => {
    log.error("route_failed", { path: req.path, error: err.message });
    if (!res.headersSent) res.status(500).json({ error: "server_error", message: "Something went wrong. Try again." });
  });

function validLanguages(sourceLang, targetLang) {
  return isLanguageCode(sourceLang) && isLanguageCode(targetLang) && targetLang !== AUTO;
}

// Config check for deploys: reports what is configured and the last observed
// Gemini outcome, without calling Gemini or Deepgram and without key material.
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    gemini: geminiHealth(),
    deepgram: { configured: Boolean(config.deepgramKey), mode: config.deepgramMode },
  });
});

app.get("/api/status", (_req, res) => {
  res.json({
    stt: Boolean(config.deepgramKey),
    sttMode: config.deepgramMode,
    autoDetect: config.deepgramMode === "enhanced",
    ai: geminiConfigured(),
    aiAvailable: geminiConfigured() && !geminiCoolingDown() && limiters.globalDay.check().ok,
    model: geminiConfigured() ? config.geminiModel : null,
    maxTextChars: config.maxTextChars,
    maxSessionMinutes: config.maxSessionMinutes,
  });
});

app.post("/api/translate", route(async (req, res) => {
  const ip = clientIp(req);
  const gate = limiters.httpTranslate.check(ip);
  if (!gate.ok) {
    res.set("Retry-After", String(Math.ceil(gate.retryAfterMs / 1000)));
    return res.status(429).json({
      error: "rate_limited",
      message: "You're translating very quickly. Wait a few seconds and try again.",
      retryAfterMs: gate.retryAfterMs,
    });
  }
  limiters.httpTranslate.hit(ip);

  const { sourceLang = AUTO, targetLang, tone } = req.body || {};
  const raw = typeof req.body?.text === "string" ? req.body.text : "";
  if (raw.length > config.maxTextChars) return bad(res, `Keep it under ${config.maxTextChars} characters.`);
  const text = cleanText(raw, config.maxTextChars);
  if (!text) return bad(res, "Nothing to translate.");
  if (!validLanguages(sourceLang, targetLang)) return bad(res, "Unknown language.");

  const r = await translate({
    text,
    sourceLang,
    targetLang,
    tone: tone === "formal" ? "formal" : "casual",
    context: cleanTurns(req.body.context, config.contextTurns, 400),
    ip,
  });
  return res.json({ text, ...r });
}));

app.post("/api/summarize", route(async (req, res) => {
  const { sourceLang = AUTO, targetLang } = req.body || {};
  if (!validLanguages(sourceLang, targetLang)) return bad(res, "Unknown language.");
  const utterances = cleanTurns(req.body?.utterances, 200, config.maxTextChars);
  if (!utterances.length) return bad(res, "There's nothing to summarize yet.");

  if (!geminiConfigured()) {
    return res.status(503).json({
      error: "ai_unconfigured",
      message: "Summaries need the AI model, which isn't set up on this server yet.",
    });
  }
  const slot = reserveAiCall("summary", clientIp(req));
  if (!slot.ok) {
    res.set("Retry-After", String(Math.ceil(slot.retryAfterMs / 1000)));
    return res.status(429).json({
      error: slot.reason,
      message:
        slot.reason === "ai_daily_cap"
          ? "Today's free AI quota is used up. Try again tomorrow."
          : "You've made a lot of summaries recently. Try again in a little while.",
      retryAfterMs: slot.retryAfterMs,
    });
  }

  try {
    const summary = await geminiSummarize({ utterances, sourceLang, targetLang });
    return res.json({ summary, model: config.geminiModel });
  } catch (err) {
    const limited = err.kind === "rate_limited" || (err.kind === "cooling_down" && geminiCoolingDown() === "rate_limited");
    return res.status(limited ? 429 : 502).json({
      error: limited ? "ai_rate_limited" : "ai_error",
      message: limited
        ? "The AI model is busy right now. Try again in a minute."
        : err.kind === "timeout"
          ? "The AI model took too long. Try again."
          : "The AI model couldn't summarize this. Try again.",
    });
  }
}));

const wss = new WebSocketServer({ server, maxPayload: 1024 * 1024 });
const socketsPerIp = new Map();

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (config.allowedOrigins.length && origin && !config.allowedOrigins.includes(origin)) {
    ws.close(1008, "Origin not allowed");
    return;
  }

  const ip = clientIp(req);
  const open = socketsPerIp.get(ip) || 0;
  if (open >= config.maxSocketsPerIp) {
    ws.send(JSON.stringify({
      type: "error",
      code: "too_many_sessions",
      message: "Too many live sessions from your network. Close other tabs and try again.",
    }));
    ws.close(1013, "Too many sessions");
    return;
  }
  socketsPerIp.set(ip, open + 1);
  ws.on("close", () => {
    const n = (socketsPerIp.get(ip) || 1) - 1;
    if (n <= 0) socketsPerIp.delete(ip);
    else socketsPerIp.set(ip, n);
  });

  new LiveSession(ws, ip);
});

wss.on("error", (err) => log.error("wss_error", { error: err.message }));

server.listen(config.port, () => {
  log.info("listening", {
    port: config.port,
    stt: Boolean(config.deepgramKey),
    sttMode: config.deepgramMode,
    ai: geminiConfigured(),
    model: config.geminiModel,
  });
});

process.on("unhandledRejection", (reason) => log.error("unhandled_rejection", { error: String(reason?.message || reason) }));
process.on("uncaughtException", (err) => log.error("uncaught_exception", { error: err.message, stack: err.stack }));
