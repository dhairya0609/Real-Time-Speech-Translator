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
  GEMINI_MODEL: "primary-model",
  GEMINI_FALLBACK_MODELS: "fallback-model",
  GEMINI_RETRY_PAUSE_MS: "50",
  GEMINI_TIMEOUT_MS: "800",
  GEMINI_SUMMARY_TIMEOUT_MS: "1000",
  GEMINI_ALTERNATIVES_TIMEOUT_MS: "1000",
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
          case "503-primary":
            if (req.model === "primary-model") throw err(503, "The model is overloaded. Please try again later.");
            return { text: good };
          case "503":
            throw err(503, "The model is overloaded. Please try again later.");
          case "503-twice":
            if (calls.length <= 2) throw err(503, "This model is currently experiencing high demand.");
            return { text: good };
          case "hang-primary":
            if (req.model === "primary-model") return new Promise(() => {});
            return { text: good };
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
  ["503-primary", true],
  ["hang-primary", true],
  ["503-twice", true],
  ["503", false],
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
    const t = calls[0]?.config?.httpOptions?.timeout;
    report(t === undefined || t >= 10_000, "translate: no server deadline under Google's 10s minimum", String(t));
  }
  if (behaviour === "503-primary") {
    const order = calls.map((c) => c.model).join(">");
    report(order === "primary-model>fallback-model", "translate: overloaded primary falls through to the next model", order);
    report(r.body.model === "fallback-model", "translate: reports the model that actually answered", String(r.body.model));
    await post("/api/translate", { ...sample, text: "next line after 503" });
    const next = calls.slice(2).map((c) => c.model).join(">");
    report(next === "fallback-model", "translate: a model that just failed is skipped on the next line", next);
  }
  if (behaviour === "503-twice") {
    const order = calls.map((c) => c.model).join(">");
    report(order === "primary-model>fallback-model>primary-model", "translate: all models busy -> pause and one more round", order);
  }
  if (behaviour === "hang-primary") {
    report(r.ms < 1000, "translate: a hanging primary still leaves time for the fallback", `${r.ms}ms`);
  }
  if (["401", "404", "429"].includes(behaviour)) {
    const again = await post("/api/translate", { ...sample, text: `second ${behaviour}` });
    // Every model in the chain gets one try, except on a bad key; then the cooldown skips Gemini.
    const expectedCalls = { 401: 1, 404: 2, 429: 4 }[behaviour];
    report(
      calls.length === expectedCalls && again.body.engine !== "gemini",
      `translate: after ${behaviour}, Gemini is skipped (cooldown)`,
      `gemini calls=${calls.length} ${again.ms}ms`
    );
  }
}

// --- Romanization and alternatives ----------------------------------------
{
  const romanStub = (romanized) => ({
    models: {
      generateContent: async (req) => {
        if (/alternative translations/.test(req.config.systemInstruction)) {
          return {
            text: JSON.stringify({
              alternatives: [
                { label: "More formal", text: "क्या आप आ सकते हैं?", romanized: "kya aap aa sakte hain?" },
                { label: "Same as before", text: "तुम आ सकते हो?" },
                { label: "Shorter", text: "आओगे?", romanized: "aaoge?" },
              ],
            }),
          };
        }
        return { text: JSON.stringify({ translation: "तुम आ सकते हो?", source_language: "en", romanized }) };
      },
    },
  });
  setGeminiClientForTests(romanStub("tum aa sakte ho?"));
  let r = await post("/api/translate", { ...sample, text: "Can you come?", targetLang: "hi" });
  report(r.body.romanized === "tum aa sakte ho?", "romanized: returned for a non-Latin target", r.body.romanized);
  setGeminiClientForTests(romanStub("तुम"));
  r = await post("/api/translate", { ...sample, text: "Can you come? (2)", targetLang: "hi" });
  report(r.body.romanized === undefined, "romanized: dropped when it isn't Latin script");
  setGeminiClientForTests(romanStub("anything"));
  r = await post("/api/translate", { ...sample, text: "Can you come? (3)", targetLang: "fr" });
  report(r.body.romanized === undefined, "romanized: never sent for Latin-script targets");

  const alt = { text: "Can you come?", translation: "तुम आ सकते हो?", sourceLang: "en", targetLang: "hi", tone: "casual" };
  r = await post("/api/alternatives", alt);
  report(
    r.status === 200 && r.body.alternatives.length === 2 && r.body.alternatives.every((a) => a.text !== alt.translation),
    "alternatives: distinct options, current translation filtered out",
    r.body.alternatives?.map((a) => a.label).join(", ")
  );
  for (const behaviour of ["hang", "throw", "prose"]) {
    stub(behaviour);
    r = await post("/api/alternatives", alt);
    report(r.status === 502 && /alternatives/i.test(r.body.message) && r.ms < 4000, `alternatives: gemini ${behaviour} -> friendly 502`, `${r.body.message} ${r.ms}ms`);
  }
  stub("429");
  r = await post("/api/alternatives", alt);
  report(r.status === 429 && /busy/i.test(r.body.message), "alternatives: rate limit -> friendly 429", r.body.message);
  setGeminiClientForTests(null);
  r = await post("/api/alternatives", alt);
  report(r.status === 503 && /aren't available/.test(r.body.message), "alternatives: no key -> friendly 503", r.body.message);
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
