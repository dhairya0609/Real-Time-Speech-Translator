import React, { useState } from "react";
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  LanguageIcon,
  SparklesIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/16/solid";
import type { Utterance } from "../types";
import { AUTO, bcp47, languageName, shortCode } from "../lib/languages";

const PROVIDER: Record<string, string> = {
  google: "Google Translate",
  mymemory: "MyMemory",
  libre: "LibreTranslate",
};

function engineTitle(u: Utterance) {
  if (u.engine === "gemini") return "AI translation that takes the earlier lines into account";
  if (u.engine === "same") return "Already in the target language";
  const provider = PROVIDER[u.engine || ""];
  return provider ? `Standard translation by ${provider}, without conversation context` : "";
}

const EngineMark: React.FC<{ u: Utterance }> = ({ u }) => {
  if (u.status !== "done" || !u.engine || u.engine === "none") return null;
  const title = engineTitle(u);
  return (
    <span title={title} aria-label={title} className="grid h-5 w-5 place-items-center">
      {u.engine === "gemini" ? (
        <SparklesIcon className="h-3 w-3 text-accent/80" />
      ) : (
        <LanguageIcon className="h-3 w-3 text-subtle/70" />
      )}
    </span>
  );
};

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

type Props = {
  u: Utterance;
  onRetry: (u: Utterance) => void;
};

const UtteranceCard: React.FC<Props> = ({ u, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const source = u.sourceLang === AUTO ? u.detectedLang : u.sourceLang;
  const time = new Date(u.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const other = u.speaker === "b";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(u.translated || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };

  const speak = () => {
    if (!u.translated) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(u.translated);
    utter.lang = bcp47(u.targetLang);
    window.speechSynthesis.speak(utter);
  };

  return (
    <article
      data-testid="utterance"
      data-speaker={u.speaker}
      className={`group w-[92%] max-w-[40rem] animate-card-in rounded-2xl border p-4 sm:w-[88%] sm:p-5 ${
        other ? "self-end border-accent/20 bg-accent/[0.045] dark:bg-accent/[0.07]" : "self-start border-line bg-surface shadow-card"
      }`}
    >
      <header className="mb-1.5 flex h-5 items-center gap-1.5 text-xs text-subtle">
        <span
          className="font-medium"
          title={`${languageName(source) || "Detected automatically"} to ${languageName(u.targetLang)}`}
        >
          {source ? shortCode(source) : "AUTO"} → {shortCode(u.targetLang)}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{time}</span>
        <span className="ml-auto flex items-center gap-0.5">
          {u.status === "done" && u.translated && (
            <span className="flex opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button type="button" onClick={copy} className="icon-btn h-7 w-7" aria-label="Copy translation" title="Copy">
                {copied ? <CheckIcon className="h-3.5 w-3.5 text-accent" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
              </button>
              {canSpeak && (
                <button type="button" onClick={speak} className="icon-btn h-7 w-7" aria-label="Read translation aloud" title="Read aloud">
                  <SpeakerWaveIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          )}
          <EngineMark u={u} />
        </span>
      </header>

      <p className="text-[15px] leading-relaxed text-muted" lang={source && source !== AUTO ? source : undefined}>
        {u.original}
      </p>

      <div className="mt-2">
        {u.status === "translating" && (
          <div className="space-y-2 py-1.5" aria-label="Translating">
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-4 w-2/5" />
          </div>
        )}
        {u.status === "done" && (
          <p key="done" className="animate-text-in text-lg font-medium leading-relaxed tracking-[-0.01em] text-fg sm:text-xl" lang={u.targetLang}>
            {u.translated}
          </p>
        )}
        {u.status === "failed" && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-0.5 text-sm">
            <span className="text-muted">{u.error || "Translation is temporarily unavailable."}</span>
            <button type="button" onClick={() => onRetry(u)} className="inline-flex items-center gap-1 font-medium text-fg underline-offset-2 hover:underline">
              <ArrowPathIcon className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export const InterimCard: React.FC<{ text: string; sourceLang: string; other: boolean }> = ({ text, sourceLang, other }) => (
  <article
    className={`w-[92%] max-w-[40rem] animate-card-in rounded-2xl border border-dashed border-accent/40 p-4 sm:w-[88%] sm:p-5 ${
      other ? "self-end" : "self-start"
    }`}
    aria-live="polite"
  >
    <header className="mb-1.5 flex h-5 items-center gap-2 text-xs font-medium text-accent">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      Listening
    </header>
    <p className="text-[15px] leading-relaxed text-fg" lang={sourceLang !== AUTO ? sourceLang : undefined}>
      {text || <span className="text-muted">Start speaking…</span>}
      <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-caret bg-accent" />
    </p>
  </article>
);

export default UtteranceCard;
