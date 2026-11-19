import React from "react";
import { CheckIcon } from "@heroicons/react/16/solid";
import Sheet from "./Sheet";
import Translation from "./Translation";
import type { Alternative } from "../types";

export type AlternativesState = {
  original: string;
  current: string;
  currentRomanized?: string;
  targetLang: string;
  loading: boolean;
  error: string | null;
  options: Alternative[];
} | null;

type Props = {
  state: AlternativesState;
  showRoman: boolean;
  onPick: (a: Alternative) => void;
  onRetry: () => void;
  onClose: () => void;
};

const AlternativesSheet: React.FC<Props> = ({ state, showRoman, onPick, onRetry, onClose }) => (
  <Sheet open={state !== null} onClose={onClose} title="Other ways to say it">
    {state && (
      <>
        <p className="mb-4 text-[15px] text-muted">{state.original}</p>
        <div className="space-y-2">
          <div className="rounded-xl border border-accent/40 bg-accent/[0.05] p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent">
              <CheckIcon className="h-3.5 w-3.5" /> Current
            </div>
            <div className="text-base font-medium leading-relaxed text-fg">
              <Translation text={state.current} lang={state.targetLang} romanized={state.currentRomanized} showRoman={showRoman} romanClassName="mt-0.5 text-sm font-normal" />
            </div>
          </div>
          {state.loading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-line p-3.5" aria-label="Finding alternatives">
                <div className="skeleton mb-2 h-3 w-20" />
                <div className="skeleton h-4 w-4/5" />
              </div>
            ))}
          {!state.loading &&
            state.options.map((a) => (
              <button
                key={a.text}
                type="button"
                onClick={() => onPick(a)}
                className="block w-full animate-fade-up rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-accent/40 hover:bg-raised/50"
              >
                <span className="mb-1 block text-xs font-medium text-subtle">{a.label || "Alternative"}</span>
                <span className="block text-base font-medium leading-relaxed text-fg">
                  <Translation text={a.text} lang={state.targetLang} romanized={a.romanized} showRoman={showRoman} romanClassName="mt-0.5 text-sm font-normal" />
                </span>
              </button>
            ))}
          {!state.loading && state.error && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3.5 text-sm">
              <span>{state.error}</span>
              <button type="button" className="shrink-0 font-medium text-fg underline-offset-2 hover:underline" onClick={onRetry}>
                Retry
              </button>
            </div>
          )}
        </div>
        {!state.loading && !state.error && <p className="mt-4 text-xs text-subtle">Pick one to use it in the conversation.</p>}
      </>
    )}
  </Sheet>
);

export default AlternativesSheet;
