// Offline check that Gemini failures fall back to the classic translators and
// never hold up the live transcript. Stubs the Gemini client and fakes
// Deepgram; the fallback translators are called for real (needs internet).
// Usage: npm run test:fallback            (standard Deepgram mode)
//        npm run test:fallback -- enhanced (DEEPGRAM_MODE=enhanced)
import { WebSocketServer } from "ws";

const mode = process.argv[2] === "enhanced" ? "enhanced" : "standard";
const fakeDg = new WebSocketServer({ port: 0 });
await new Promise((r) => fakeDg.on("listening", r));
const PORT = 5600 + Math.floor(Math.random() * 300);

Object.assign(process.env, {
  PORT: String(PORT),
  GEMINI_API_KEY: "",
  DEEPGRAM_API_KEY: "fake-deepgram-key",
  DEEPGRAM_WS_URL: `ws://127.0.0.1:${fakeDg.address().port}/v1/listen`,
  DEEPGRAM_MODE: mode,
  GEMINI_TIMEOUT_MS: "800",
  GEMINI_SUMMARY_TIMEOUT_MS: "1000",
  AI_TRANSLATE_PER_MIN: "1000",
  AI_TRANSLATE_PER_DAY: "1000",
  AI_SUMMARY_PER_HOUR: "1000",
  AI_GLOBAL_PER_MIN: "1000",
  TRANSLATE_PER_MIN: "1000",
});

const { setGeminiClientForTests } = await import("../lib/gemini.js");
await import("../server.js");
await new Promise((r) => setTimeout(r, 200));
const base = `http://127.0.0.1:${PORT}`;

let failures = 0;
function report(ok, name, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function stub(behaviour) {
  const calls = [];
  const err = (status, message) => Object.assign(new Error(message), { status });
  const client = {
    models: {
      generateContent: async (req) => {
        calls.push(req);
        const minimal = !req.config.responseJsonSchema;
        const current = /CURRENT: (.*)$/s.exec(req.contents)?.[1] ?? "";
        const good = JSON.stringify({ translation: `[gemini] ${current}`, source_language: "en" });
        switch (behaviour) {
          case "ok":
            return { text: good };
          case "fenced":
            return { text: "```json\n" + good + "\n```" };
          case "throw":
            throw new Error("socket hang up");
          case "400-then-minimal":
            if (!minimal) throw err(400, "Invalid JSON payload received. Unknown name \"thinkingLevel\"");
            return { text: good };
          case "400":
            throw err(400, "Request contains an invalid argument.");
          case "401":
            throw err(401, "API key not valid. Please pass a valid API key.");
          case "404":
            throw err(404, "models/gemini-x is not found for API version v1");
          case "429":
            throw err(429, "Resource has been exhausted. Please retry in 12.5s.");
          case "hang":
            return new Promise(() => {});
          case "empty":
            return { text: "" };
          case "undefined":
            return {};
          case "prose":
            return { text: "Sure! Here is the translation: Bonjour" };
          case "wrong-shape":
            return { text: JSON.stringify({ foo: 1 }) };
          default:
            throw new Error("unknown behaviour");
        }
      },
    },
  };
  setGeminiClientForTests(client);
  return calls;
}

async function post(path, body) {
  const started = Date.now();
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return { status: res.status, body: await res.json(), ms: Date.now() - started };
  } catch (err) {
    return { status: 0, body: { error: err.name }, ms: Date.now() - started };
  }
}

const sample = {
  text: "Good morning, how are you?",
  sourceLang: "en",
  targetLang: "fr",
  tone: "casual",
  context: [{ original: "Hi Marie.", translated: "Salut Marie." }],
};

// --- HTTP translation -------------------------------------------------------
for (const [behaviour, expectGemini] of [
  ["ok", true],
  ["fenced", true],
  ["400-then-minimal", true],
  ["throw", false],
  ["400", false],
  ["401", false],
  ["404", false],
  ["429", false],
  ["hang", false],
  ["empty", false],
  ["undefined", false],
  ["prose", false],
  ["wrong-shape", false],
]) {
  const calls = stub(behaviour);
  const r = await post("/api/translate", { ...sample, text: `${sample.text} (${behaviour})` });
  const engineOk = expectGemini ? r.body.engine === "gemini" : r.body.engine !== "gemini" && r.body.engine !== "none";
  report(
    r.status === 200 && engineOk && r.body.translated && r.ms < 8000,
    `translate: gemini ${behaviour} -> ${expectGemini ? "gemini" : "fallback"}`,
    `engine=${r.body.engine} notice=${r.body.notice ?? "-"} ${r.ms}ms`
  );
  if (behaviour === "ok") {
    report(calls[0]?.contents.includes("Hi Marie. => Salut Marie."), "translate: previous turns are sent as context");
  }
  if (["401", "404", "429"].includes(behaviour)) {
    const again = await post("/api/translate", { ...sample, text: `second ${behaviour}` });
    report(
      calls.length === 1 && again.body.engine !== "gemini",
      `translate: after ${behaviour}, Gemini is skipped (cooldown)`,
      `gemini calls=${calls.length} ${again.ms}ms`
    );
  }
}

// --- Summary ----------------------------------------------------------------
const convo = {
  sourceLang: "en",
  targetLang: "es",
  utterances: [
    { original: "Let's ship on Friday.", translated: "Lancemos el viernes." },
    { original: "Ana will write the copy.", translated: "Ana escribirá los textos." },
  ],
};

setGeminiClientForTests(null);
let s = await post("/api/summarize", convo);
report(s.status === 503 && s.body.error === "ai_unconfigured" && /aren't available/.test(s.body.message), "summary: missing key -> friendly 503", s.body.message);

for (const behaviour of ["throw", "hang", "401", "429", "prose", "400"]) {
  stub(behaviour);
  s = await post("/api/summarize", convo);
  report(
    [429, 502].includes(s.status) && typeof s.body.message === "string" && !/error:|stack|status|gemini|model|api/i.test(s.body.message) && s.ms < 5000,
    `summary: gemini ${behaviour} -> friendly ${s.status}`,
    `${s.body.message} ${s.ms}ms`
  );
}

stub("ok");
const summaryStub = {
  models: {
    generateContent: async () => ({
      text: JSON.stringify({
        source: { summary: "Ship Friday.", action_items: ["Ana: write the copy"] },
        target: { summary: "Lanzar el viernes.", action_items: ["Ana: escribir los textos"] },
      }),
    }),
  },
};
setGeminiClientForTests(summaryStub);
s = await post("/api/summarize", convo);
report(s.status === 200 && s.body.summary?.target?.actionItems?.length === 1, "summary: ok -> both languages + action items");

// --- Live stream with a hanging Gemini ---------------------------------------
stub("hang");
const dgRequests = [];
fakeDg.on("connection", (sock, req) => {
  dgRequests.push({ url: req.url, auth: req.headers.authorization });
  let fired = false;
  const results = (transcript, extra = {}) =>
    JSON.stringify({ type: "Results", is_final: true, channel: { alternatives: [{ transcript, words: [] }] }, ...extra });
  sock.on("message", (data, isBinary) => {
    if (!isBinary) {
      if (JSON.parse(data.toString()).type === "CloseStream") sock.close();
      return;
    }
    if (fired) return;
    fired = true;
    const t0 = Date.now();
    sock.emittedAt = t0;
    if (mode === "standard") {
      sock.send(results("Hello there."));
      setTimeout(() => sock.send(results("How are you today?")), 100);
    } else {
      const word = (w) => ({ word: w, language: "es" });
      sock.send(JSON.stringify({ type: "Results", is_final: false, channel: { alternatives: [{ transcript: "hola", words: [] }] } }));
      setTimeout(() => sock.send(JSON.stringify({ type: "Results", is_final: true, speech_final: false, channel: { alternatives: [{ transcript: "Hola, ¿cómo", words: [word("hola"), word("cómo")] }] } })), 50);
      setTimeout(() => sock.send(JSON.stringify({ type: "Results", is_final: true, speech_final: true, channel: { alternatives: [{ transcript: "estás hoy?", words: [word("estás"), word("hoy")] }] } })), 100);
    }
  });
});

const events = [];
const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
await new Promise((r) => (ws.onopen = r));
const t0 = Date.now();
ws.onmessage = (ev) => events.push({ ...JSON.parse(ev.data), at: Date.now() - t0 });
ws.send(JSON.stringify({ type: "start", sourceLang: mode === "enhanced" ? "auto" : "en", targetLang: "fr", tone: "casual" }));
await new Promise((r) => setTimeout(r, 200));
ws.send(new Uint8Array([26, 69, 223, 163]));
await new Promise((r) => setTimeout(r, 300));
const utterancesEarly = events.filter((e) => e.type === "utterance");
for (let waited = 0; waited < 16000; waited += 250) {
  if (events.filter((e) => e.type === "translation").length >= utterancesEarly.length) break;
  await new Promise((r) => setTimeout(r, 250));
}
ws.send(JSON.stringify({ type: "stop" }));
await new Promise((r) => setTimeout(r, 500));
ws.close();

const dg = dgRequests[0] || {};
report(dg.auth === "Token fake-deepgram-key", "live: Deepgram gets the Token auth header");
if (mode === "standard") {
  report(
    dg.url === "/v1/listen?punctuate=true&language=en&utterances=true&sample_rate=48000&channels=1",
    "live: standard mode sends the original Deepgram query",
    dg.url
  );
  report(utterancesEarly.length === 2, "live: both finals reach the client within 300ms while Gemini hangs", `${utterancesEarly.map((e) => `${e.at}ms`).join(", ")}`);
} else {
  report(/model=nova-3/.test(dg.url) && /language=multi/.test(dg.url) && /interim_results=true/.test(dg.url), "live: enhanced mode asks for nova-3 multilingual", dg.url);
  report(events.some((e) => e.type === "transcript" && e.text === "hola"), "live: interim text is streamed");
  report(
    utterancesEarly.length === 1 && utterancesEarly[0].text === "Hola, ¿cómo estás hoy?" && utterancesEarly[0].detectedLang === "es",
    "live: segments grouped into one utterance with detected language",
    JSON.stringify(utterancesEarly.map((u) => [u.text, u.detectedLang]))
  );
}
const translations = events.filter((e) => e.type === "translation");
report(
  translations.length === utterancesEarly.length && translations.every((t) => t.engine !== "gemini" && t.translated && t.notice === "ai_timeout"),
  "live: each utterance still gets a fallback translation after the Gemini timeout",
  translations.map((t) => `${t.engine}/${t.notice} @${t.at}ms`).join(", ")
);
report(events.some((e) => e.type === "stopped"), "live: stop flushes and reports stopped");

const health = await (await fetch(`${base}/health`)).json();
report(
  health.ok && health.deepgram.configured && health.deepgram.mode === mode && !JSON.stringify(health).includes("fake-deepgram-key"),
  "health: reports config without key material",
  JSON.stringify(health)
);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
