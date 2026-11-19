import React, { useEffect, useRef, useState } from "react";
import {
  ArrowsPointingOutIcon,
  ChatBubbleLeftEllipsisIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  SpeakerWaveIcon,
  StarIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import Translation from "./Translation";
import { ApiError, TranslateResponse, translateText } from "../lib/api";
import { AUTO, languageName } from "../lib/languages";
import { canSpeak, speak } from "../lib/voices";
import type { Tone } from "../types";

export type TextResult = TranslateResponse & { sourceLang: string; targetLang: string };

type Props = {
  sourceLang: string;
  targetLang: string;
  tone: Tone;
  maxChars: number;
  showRoman: boolean;
  aiOn: boolean;
  online: boolean;
  swapSignal: number;
  isSaved: (original: string, translated: string) => boolean;
  onToggleSave: (r: TextResult) => void;
  onAlternatives: (r: TextResult, apply: (text: string, romanized?: string) => void) => void;
  onShow: (r: TextResult) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
};

const DEBOUNCE_MS = 650;

const TextView: React.FC<Props> = ({
  sourceLang, targetLang, tone, maxChars, showRoman, aiOn, online, swapSignal, isSaved, onToggleSave, onAlternatives, onShow, inputRef,
}) => {
  const [text, setText] = useState("");
  const [result, setResult] = useState<TextResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);
  const resultRef = useRef(result);
  resultRef.current = result;

  const run = async (value: string) => {
    const trimmed = value.trim();
    const id = ++seq.current;
    if (!trimmed) {
      setResult(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (!online) {
      setError("You're offline. This will translate when you're back online.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await translateText({ text: trimmed, sourceLang, targetLang, tone, context: [] });
      if (id !== seq.current) return;
      if (r.notice === "translation_failed") setError("Translation is temporarily unavailable.");
      else setResult({ ...r, sourceLang, targetLang });
    } catch (err) {
      if (id === seq.current) setError((err as ApiError).message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => run(text), text.trim() ? DEBOUNCE_MS : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, sourceLang, targetLang, tone, online]);

  useEffect(() => {
    if (!swapSignal) return;
    const r = resultRef.current;
    if (r?.translated) setText(r.translated);
  }, [swapSignal]);

  const over = text.length > maxChars;
  const r = result;
  const fromLabel = sourceLang === AUTO ? (r?.detectedLang ? `${languageName(r.detectedLang)} · detected` : "Detect language") : languageName(sourceLang);
  const saved = r ? isSaved(r.text, r.translated) : false;

  const copy = async () => {
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r.translated);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="scroll-area min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl gap-3 px-4 py-4 sm:px-6 sm:py-6 md:grid-cols-2 md:gap-0">
        <section className="flex min-h-[11rem] flex-col rounded-2xl border border-line bg-surface shadow-card md:min-h-[22rem] md:rounded-r-none">
          <p className="px-5 pt-4 text-xs font-medium text-subtle">{fromLabel}</p>
          <label htmlFor="text-input" className="sr-only">
            Text to translate
          </label>
          <textarea
            id="text-input"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(text);
            }}
            placeholder="Type or paste text"
            className="min-h-[7rem] flex-1 resize-none bg-transparent px-5 py-2 text-xl leading-relaxed outline-none placeholder:text-subtle md:text-2xl"
          />
          <div className="flex h-12 items-center gap-2 px-3">
            {text && (
              <button type="button" className="icon-btn h-8 w-8" aria-label="Clear text" onClick={() => setText("")}>
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
            {text.length > maxChars * 0.8 && (
              <span className={`ml-auto pr-2 font-mono text-[11px] tabular-nums ${over ? "text-danger" : "text-subtle"}`}>
                {text.length}/{maxChars}
              </span>
            )}
          </div>
        </section>

        <section
          className="flex min-h-[11rem] flex-col rounded-2xl border border-line bg-raised/50 md:min-h-[22rem] md:rounded-l-none md:border-l-0"
          aria-live="polite"
          aria-busy={loading}
        >
          <p className="px-5 pt-4 text-xs font-medium text-subtle">{languageName(targetLang)}</p>
          <div className="flex-1 px-5 py-2 text-xl font-medium leading-relaxed md:text-2xl">
            {!text.trim() && <span className="font-normal text-subtle">Translation</span>}
            {text.trim() && error && <span className="text-base font-normal text-muted">{error}</span>}
            {text.trim() && !error && r && (
              <span className={`block transition-opacity ${loading ? "opacity-50" : ""}`}>
                {aiOn ? (
                  <button
                    type="button"
                    className="text-left decoration-accent/40 decoration-dotted underline-offset-[6px] hover:underline"
                    title="Other ways to say it"
                    onClick={() => onAlternatives(r, (t, romanized) => setResult({ ...r, translated: t, romanized }))}
                  >
                    <Translation text={r.translated} lang={r.targetLang} romanized={r.romanized} showRoman={showRoman} romanClassName="mt-1 text-base font-normal" />
                  </button>
                ) : (
                  <Translation text={r.translated} lang={r.targetLang} romanized={r.romanized} showRoman={showRoman} romanClassName="mt-1 text-base font-normal" />
                )}
              </span>
            )}
            {text.trim() && !error && !r && loading && (
              <span className="block space-y-2.5 pt-2">
                <span className="skeleton block h-5 w-4/5" />
                <span className="skeleton block h-5 w-1/2" />
              </span>
            )}
          </div>
          <div className="flex h-12 items-center gap-1 px-3">
            {r && text.trim() && !error && (
              <>
                {canSpeak(r.targetLang) && (
                  <button type="button" className="icon-btn h-8 w-8" aria-label="Listen" title="Listen" onClick={() => speak(r.translated, r.targetLang)}>
                    <SpeakerWaveIcon className="h-4 w-4" />
                  </button>
                )}
                <button type="button" className="icon-btn h-8 w-8" aria-label="Copy translation" title="Copy" onClick={copy}>
                  {copied ? <CheckIcon className="h-4 w-4 text-accent" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className={`icon-btn h-8 w-8 ${saved ? "text-amber-500 hover:text-amber-500" : ""}`}
                  aria-label={saved ? "Remove from saved" : "Save phrase"}
                  aria-pressed={saved}
                  title={saved ? "Saved" : "Save phrase"}
                  onClick={() => onToggleSave(r)}
                >
                  {saved ? <StarIcon className="h-4 w-4" /> : <StarOutline className="h-4 w-4" />}
                </button>
                <button type="button" className="icon-btn h-8 w-8" aria-label="Show full screen" title="Show full screen" onClick={() => onShow(r)}>
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                </button>
                {aiOn && (
                  <button
                    type="button"
                    className="btn ml-auto h-8 px-2.5 text-xs"
                    onClick={() => onAlternatives(r, (t, romanized) => setResult({ ...r, translated: t, romanized }))}
                  >
                    <ChatBubbleLeftEllipsisIcon className="h-3.5 w-3.5 text-accent" /> Alternatives
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TextView;
