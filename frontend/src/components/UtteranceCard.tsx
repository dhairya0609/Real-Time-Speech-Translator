import React, { useState } from "react";
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  SparklesIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/16/solid";
import type { Utterance } from "../types";
import { AUTO, bcp47, shortCode } from "../lib/languages";

const NOTICE_TEXT: Record<string, string> = {
  ai_unconfigured: "AI translation isn't configured on the server, so a classic translator was used.",
  ai_rate_limited: "AI limit reached for now, so a classic translator was used.",
  ai_daily_cap: "Today's free AI quota is used up, so a classic translator was used.",
  ai_busy: "The AI model was busy, so a classic translator was used.",
  ai_timeout: "The AI model was slow, so a classic translator was used.",
  ai_error: "The AI model failed, so a classic translator was used.",
  translation_failed: "Every translator failed for this one.",
};

const ENGINE_LABEL: Record<string, string> = {
  google: "Google",
  mymemory: "MyMemory",
  libre: "Libre",
  same: "Same language",
  none: "Untranslated",
};

function prettyModel(model?: string) {
  if (!model) return "Gemini";
  return model
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

export const EngineBadge: React.FC<{ u: Utterance }> = ({ u }) => {
  if (u.status !== "done" || !u.engine) return null;
  if (u.engine === "gemini") {
    return (
      <span className="inline-flex items-center gap-1 text-accent" title={`Translated by ${prettyModel(u.model)} with conversation context`}>
        <SparklesIcon className="h-3 w-3" />
        Gemini
      </span>
    );
  }
  return (
    <span title={u.notice ? NOTICE_TEXT[u.notice] : undefined} className="text-subtle">
      {ENGINE_LABEL[u.engine] || u.engine}
    </span>
  );
};

type Props = {
  u: Utterance;
  onRetry: (u: Utterance) => void;
};

const UtteranceCard: React.FC<Props> = ({ u, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const source = u.sourceLang === AUTO ? u.detectedLang : u.sourceLang;
  const time = new Date(u.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
    <article className="group animate-fade-up rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5" data-testid="utterance">
      <header className="mb-2 flex items-center gap-2 text-xs text-subtle">
        {u.via === "voice" ? <MicrophoneIcon className="h-3 w-3" /> : <PencilSquareIcon className="h-3 w-3" />}
        <span className="tabular-nums">{time}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono text-[11px]">
          {source ? shortCode(source) : "AUTO"} → {shortCode(u.targetLang)}
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs font-medium">
          {u.status === "done" && u.translated && (
            <span className="-my-1.5 flex opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button type="button" onClick={copy} className="icon-btn h-7 w-7" aria-label="Copy translation" title="Copy translation">
                {copied ? <CheckIcon className="h-3.5 w-3.5 text-accent" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
              </button>
              {canSpeak && (
                <button type="button" onClick={speak} className="icon-btn h-7 w-7" aria-label="Read translation aloud" title="Read aloud">
                  <SpeakerWaveIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {u.engine !== "gemini" && u.engine !== "same" && (
                <button type="button" onClick={() => onRetry(u)} className="icon-btn hidden h-7 w-7 sm:inline-flex" aria-label="Translate again" title="Translate again">
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          )}
          <EngineBadge u={u} />
        </span>
      </header>

      <p className="text-[15px] leading-relaxed text-muted" lang={source && source !== AUTO ? source : undefined}>
        {u.original}
      </p>

      <div className="mt-2.5">
        {u.status === "translating" && (
          <div className="space-y-2 py-1" aria-label="Translating">
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-4 w-2/5" />
          </div>
        )}
        {u.status === "done" && (
          <p className="text-lg font-medium leading-relaxed tracking-[-0.01em] text-fg sm:text-xl" lang={u.targetLang}>
            {u.translated}
          </p>
        )}
        {u.status === "failed" && (
          <div className="flex items-center gap-3 text-sm text-danger">
            <span>{u.error || "Couldn't translate this one."}</span>
            <button type="button" onClick={() => onRetry(u)} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
              <ArrowPathIcon className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}
      </div>

    </article>
  );
};

export const InterimCard: React.FC<{ text: string; sourceLang: string }> = ({ text, sourceLang }) => (
  <article className="animate-fade-up rounded-xl border border-dashed border-accent/40 bg-accent/[0.03] p-4 sm:p-5" aria-live="polite">
    <header className="mb-2 flex items-center gap-2 text-xs text-accent">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      Hearing you
    </header>
    <p className="text-[15px] leading-relaxed text-fg" lang={sourceLang !== AUTO ? sourceLang : undefined}>
      {text || <span className="text-muted">Listening…</span>}
      <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-caret bg-accent" />
    </p>
  </article>
);

export default UtteranceCard;
