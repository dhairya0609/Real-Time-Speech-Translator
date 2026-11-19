// Live check of the Gemini paths. Needs GEMINI_API_KEY (env or backend/.env).
// Usage: npm run smoke:ai   (from backend/)
import config from "../lib/config.js";
import { geminiSummarize, geminiTranslate } from "../lib/gemini.js";
import { translate } from "../lib/translator.js";

if (!config.geminiKey) {
  console.error("FAIL  GEMINI_API_KEY is not set (export it or add it to backend/.env)");
  process.exit(1);
}

console.log(`model: ${config.geminiModel}  thinking: ${config.geminiThinkingLevel}  timeout: ${config.translateTimeoutMs}ms\n`);

let failures = 0;

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    console.log(`PASS  ${name}  (${Date.now() - started} ms)${detail ? `\n      ${detail}` : ""}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${name}  (${Date.now() - started} ms)\n      ${err.kind ? `[${err.kind}] ` : ""}${err.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

await check("context resolves a pronoun (EN->FR, 'it' = la voiture)", async () => {
  const r = await geminiTranslate({
    text: "It's parked outside, next to the bakery.",
    sourceLang: "en",
    targetLang: "fr",
    tone: "casual",
    context: [{ original: "Where did you leave the car?", translated: "Où as-tu laissé la voiture ?" }],
  });
  expect(/\b(elle|garée)\b/i.test(r.translated), `expected feminine agreement with "la voiture": ${r.translated}`);
  return r.translated;
});

await check("idiom is not translated word for word (EN->FR)", async () => {
  const r = await geminiTranslate({ text: "It's raining cats and dogs.", sourceLang: "en", targetLang: "fr", tone: "casual" });
  expect(!/chat|chien/i.test(r.translated), `literal idiom: ${r.translated}`);
  return r.translated;
});

await check("formal tone uses 'Sie' (EN->DE)", async () => {
  const r = await geminiTranslate({ text: "Can you send me the report?", sourceLang: "en", targetLang: "de", tone: "formal" });
  expect(/\bSie\b/.test(r.translated), `expected formal address: ${r.translated}`);
  return r.translated;
});

await check("casual tone uses 'du' (EN->DE)", async () => {
  const r = await geminiTranslate({ text: "Can you send me the report?", sourceLang: "en", targetLang: "de", tone: "casual" });
  expect(/\b(du|dir|mir)\b/i.test(r.translated) && !/\bSie\b/.test(r.translated), `expected informal address: ${r.translated}`);
  return r.translated;
});

await check("auto-detects the source language (ES->EN)", async () => {
  const r = await geminiTranslate({ text: "¿Dónde está la estación de tren?", sourceLang: "auto", targetLang: "en", tone: "casual" });
  expect(r.detectedLang === "es", `detected ${r.detectedLang}`);
  expect(/station/i.test(r.translated), r.translated);
  return `${r.detectedLang}: ${r.translated}`;
});

await check("translator picks Gemini, not the fallback", async () => {
  const r = await translate({ text: "See you tomorrow at nine.", sourceLang: "en", targetLang: "hi", tone: "casual", context: [], ip: "smoke" });
  expect(r.engine === "gemini", `engine=${r.engine} notice=${r.notice}`);
  return r.translated;
});

await check("summary in both languages with action items", async () => {
  const s = await geminiSummarize({
    sourceLang: "en",
    targetLang: "es",
    utterances: [
      { original: "Thanks for joining. We need to ship the new pricing page this week.", translated: "Gracias por unirte. Tenemos que lanzar la nueva página de precios esta semana." },
      { original: "Ana, can you finish the copy by Wednesday?", translated: "Ana, ¿puedes terminar los textos para el miércoles?" },
      { original: "Sí, y Luis revisará el diseño el jueves.", translated: "Yes, and Luis will review the design on Thursday." },
      { original: "Great. Let's launch on Friday morning.", translated: "Genial. Lancemos el viernes por la mañana." },
    ],
  });
  expect(s.source.summary && s.target.summary, "missing summary text");
  expect(s.source.actionItems.length >= 2 && s.target.actionItems.length >= 2, "expected at least two action items per language");
  return `EN: ${s.source.summary}\n      ES: ${s.target.summary}\n      items: ${s.source.actionItems.join(" | ")}`;
});

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
