import type { Summary, Utterance } from "../types";
import { AUTO, languageName } from "./languages";

function time(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function sourceOf(u: Utterance) {
  return languageName(u.sourceLang === AUTO ? u.detectedLang || AUTO : u.sourceLang);
}

export function toMarkdown(utterances: Utterance[], summary: Summary | null) {
  const started = utterances[0]?.at ?? Date.now();
  const lines = [`# Conversation`, "", `${new Date(started).toLocaleString()} · ${utterances.length} messages · Live Translator`, ""];

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
      `**${time(u.at)}** · ${sourceOf(u)} → ${languageName(u.targetLang)}`,
      "",
      `> ${u.original}`,
      "",
      u.translated || "_(not translated)_",
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
    lines.push(`[${time(u.at)}] ${sourceOf(u)}: ${u.original}`, `[${time(u.at)}] ${languageName(u.targetLang)}: ${u.translated || "(not translated)"}`, "");
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
