import React, { useRef, useState } from "react";
import {
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  ArrowUpOnSquareIcon,
  ChatBubbleLeftEllipsisIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  EllipsisHorizontalIcon,
  LanguageIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  StarIcon,
} from "@heroicons/react/16/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import Popover from "./Popover";
import Translation from "./Translation";
import type { Utterance } from "../types";
import { AUTO, languageName, shortCode } from "../lib/languages";
import { canSpeak, speak } from "../lib/voices";

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
    <span title={title} aria-label={title} className="grid h-7 w-5 place-items-center">
      {u.engine === "gemini" ? <SparklesIcon className="h-3 w-3 text-accent/80" /> : <LanguageIcon className="h-3 w-3 text-subtle/70" />}
    </span>
  );
};

const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

type Props = {
  u: Utterance;
  showRoman: boolean;
  saved: boolean;
  aiOn: boolean;
  onRetry: (u: Utterance) => void;
  onToggleSave: (u: Utterance) => void;
  onAlternatives: (u: Utterance) => void;
  onShow: (u: Utterance) => void;
};

const UtteranceCard: React.FC<Props> = ({ u, showRoman, saved, aiOn, onRetry, onToggleSave, onAlternatives, onShow }) => {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const source = u.sourceLang === AUTO ? u.detectedLang : u.sourceLang;
  const time = new Date(u.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const other = u.speaker === "b";
  const done = u.status === "done" && Boolean(u.translated);
  const canRephrase = aiOn && done && u.engine !== "same";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(u.translated || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };

  const share = async () => {
    try {
      await navigator.share({ text: `${u.translated}\n\n${u.original}` });
    } catch {
      /* dismissed */
    }
  };

  const listen = () => {
    setSpeaking(true);
    speak(u.translated || "", u.targetLang, () => setSpeaking(false));
  };

  const closeThen = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <article
      data-testid="utterance"
      data-speaker={u.speaker}
      className={`group w-[92%] max-w-[40rem] animate-card-in rounded-2xl border p-4 sm:w-[88%] sm:p-5 ${
        other ? "self-end border-accent/20 bg-accent/[0.045] dark:bg-accent/[0.07]" : "self-start border-line bg-surface shadow-card"
      }`}
    >
      <header className="mb-1 flex h-7 items-center gap-1.5 text-xs text-subtle">
        {u.sourceLang === AUTO && u.detectedLang ? (
          <span className="rounded-full bg-raised px-2 py-0.5 font-medium text-muted" title="Language detected automatically">
            {languageName(u.detectedLang)} · detected
          </span>
        ) : (
          <span className="font-medium" title={`${languageName(source)} to ${languageName(u.targetLang)}`}>
            {source ? shortCode(source) : "AUTO"} → {shortCode(u.targetLang)}
          </span>
        )}
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{time}</span>
        <span className="ml-auto flex items-center">
          {done && (
            <span className="flex items-center opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              {canSpeak(u.targetLang) && (
                <button type="button" onClick={listen} className={`icon-btn h-7 w-7 ${speaking ? "text-accent" : ""}`} aria-label="Listen" title="Listen">
                  <SpeakerWaveIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                ref={moreRef}
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="icon-btn h-7 w-7"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </button>
            </span>
          )}
          {done && (
            <button
              type="button"
              onClick={() => onToggleSave(u)}
              className={`icon-btn h-7 w-7 ${
                saved ? "text-amber-500 hover:text-amber-500" : "opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              }`}
              aria-label={saved ? "Remove from saved" : "Save phrase"}
              aria-pressed={saved}
              title={saved ? "Saved" : "Save phrase"}
            >
              {saved ? <StarIcon className="h-3.5 w-3.5" /> : <StarOutline className="h-3.5 w-3.5" />}
            </button>
          )}
          <EngineMark u={u} />
        </span>
      </header>

      <p className="text-[15px] leading-relaxed text-muted" lang={source && source !== AUTO ? source : undefined}>
        {u.original}
      </p>

      <div className="mt-2">
        {u.status === "translating" && (
          <div className="py-1.5" aria-label="Translating">
            <div className="space-y-2">
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-4 w-2/5" />
            </div>
            <p className={`mt-2 text-xs text-subtle ${u.waiting ? "" : "animate-[fade-in_300ms_ease-out_5s_both]"}`}>
              {u.waiting ? "Waiting for a connection. This line will translate as soon as you're back online." : "Still translating…"}
            </p>
          </div>
        )}
        {done && (
          <div className="animate-text-in text-lg font-medium leading-relaxed tracking-[-0.01em] text-fg sm:text-xl">
            {canRephrase ? (
              <button
                type="button"
                onClick={() => onAlternatives(u)}
                title="Other ways to say it"
                className="rounded-md text-left decoration-accent/40 decoration-dotted underline-offset-[6px] hover:underline"
              >
                <Translation text={u.translated!} lang={u.targetLang} romanized={u.romanized} showRoman={showRoman} />
              </button>
            ) : (
              <Translation text={u.translated!} lang={u.targetLang} romanized={u.romanized} showRoman={showRoman} />
            )}
          </div>
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

      <Popover anchor={moreRef.current} open={menuOpen} onClose={() => setMenuOpen(false)}>
        {canRephrase && (
          <button type="button" role="menuitem" className="menu-item" onClick={closeThen(() => onAlternatives(u))}>
            <ChatBubbleLeftEllipsisIcon className="h-4 w-4 text-subtle" /> Other ways to say it
          </button>
        )}
        <button type="button" role="menuitem" className="menu-item" onClick={() => copy().then(() => setTimeout(() => setMenuOpen(false), 600))}>
          {copied ? <CheckIcon className="h-4 w-4 text-accent" /> : <ClipboardDocumentIcon className="h-4 w-4 text-subtle" />}
          {copied ? "Copied" : "Copy translation"}
        </button>
        {canShare && (
          <button type="button" role="menuitem" className="menu-item" onClick={closeThen(share)}>
            <ArrowUpOnSquareIcon className="h-4 w-4 text-subtle" /> Share
          </button>
        )}
        <button type="button" role="menuitem" className="menu-item" onClick={closeThen(() => onShow(u))}>
          <ArrowsPointingOutIcon className="h-4 w-4 text-subtle" /> Show full screen
        </button>
        {u.engine !== "gemini" && u.engine !== "same" && (
          <button type="button" role="menuitem" className="menu-item" onClick={closeThen(() => onRetry(u))}>
            <ArrowPathIcon className="h-4 w-4 text-subtle" /> Translate again
          </button>
        )}
      </Popover>
    </article>
  );
};

export const InterimCard: React.FC<{ text: string; sourceLang: string; other: boolean }> = ({ text, sourceLang, other }) => (
  <article
    className={`w-[92%] max-w-[40rem] animate-card-in rounded-2xl border border-dashed border-accent/40 p-4 sm:w-[88%] sm:p-5 ${other ? "self-end" : "self-start"}`}
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
