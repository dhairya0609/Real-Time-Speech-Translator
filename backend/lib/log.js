import config from "./config.js";

// Transcripts and translations are user content: log only metadata (lengths,
// engines, timings), never the text itself, and never the API keys.
const secrets = [config.geminiKey, config.deepgramKey].filter((s) => s && s.length >= 8);

export function redact(value) {
  let out = String(value ?? "");
  for (const s of secrets) out = out.split(s).join("[redacted]");
  return out;
}

function write(level, event, fields) {
  const line = { t: new Date().toISOString(), level, event, ...fields };
  const text = redact(JSON.stringify(line));
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

const log = {
  info: (event, fields = {}) => write("info", event, fields),
  warn: (event, fields = {}) => write("warn", event, fields),
  error: (event, fields = {}) => write("error", event, fields),
};

export default log;
