import type { Summary, Utterance } from "../types";
import { AUTO, languageName } from "./languages";

const ENGINE_LABEL: Record<string, string> = {
  gemini: "Gemini",
  google: "Google Translate",
  mymemory: "MyMemory",
  libre: "LibreTranslate",
  same: "same language",
  none: "not translated",
};

function time(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function sourceOf(u: Utterance) {
  return languageName(u.sourceLang === AUTO ? u.detectedLang || AUTO : u.sourceLang);
}

export function toMarkdown(utterances: Utterance[], summary: Summary | null) {
  const started = utterances[0]?.at ?? Date.now();
  const lines = [`# Conversation transcript`, "", `${new Date(started).toLocaleString()} · ${utterances.length} utterances`, ""];

  if (summary) {
    for (const [lang, side] of [
      [summary.sourceLang, summary.source],
      [summary.targetLang, summary.target],
    ] as const) {
      lines.push(`## Summary (${languageName(lang)})`, "", side.summary, "");
      if (side.actionItems.length) {
        lines.push("**Action items**", "", ...side.actionItems.map((a) => `- [ ] ${a}`), "");
      }
    }
  }

  lines.push("## Transcript", "");
  for (const u of utterances) {
    lines.push(
      `**${time(u.at)}** · ${sourceOf(u)} → ${languageName(u.targetLang)} · _${ENGINE_LABEL[u.engine || "none"]}_`,
      "",
      `> ${u.original}`,
      "",
      u.translated || "_(no translation)_",
      ""
    );
  }
  return lines.join("\n");
}

export function toPlainText(utterances: Utterance[], summary: Summary | null) {
  const lines: string[] = [];
  if (summary) {
    for (const [lang, side] of [
      [summary.sourceLang, summary.source],
      [summary.targetLang, summary.target],
    ] as const) {
      lines.push(`SUMMARY (${languageName(lang)})`, side.summary);
      side.actionItems.forEach((a) => lines.push(`  - ${a}`));
      lines.push("");
    }
  }
  for (const u of utterances) {
    lines.push(`[${time(u.at)}] ${sourceOf(u)}: ${u.original}`, `[${time(u.at)}] ${languageName(u.targetLang)}: ${u.translated || "(no translation)"}`, "");
  }
  return lines.join("\n");
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportName(ext: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `translation-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}
