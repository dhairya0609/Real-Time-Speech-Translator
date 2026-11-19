import React, { useState } from "react";
import { ArrowsRightLeftIcon } from "@heroicons/react/20/solid";
import LanguagePicker from "./LanguagePicker";
import { AUTO } from "../lib/languages";
import type { Tone } from "../types";

type Props = {
  sourceLang: string;
  targetLang: string;
  detected?: string;
  autoHint: string;
  tone: Tone;
  onSource: (code: string) => void;
  onTarget: (code: string) => void;
  onSwap: () => void;
  onTone: (tone: Tone) => void;
};

export const ToneToggle: React.FC<{ value: Tone; onChange: (t: Tone) => void; compact?: boolean }> = ({ value, onChange, compact }) => (
  <div
    role="radiogroup"
    aria-label="Translation tone"
    className={`flex shrink-0 items-center rounded-full border border-line bg-surface p-1 shadow-card ${compact ? "h-8 [&>button]:h-6 [&>button]:px-2.5 [&>button]:text-xs" : "h-10"}`}
  >
    {(["casual", "formal"] as const).map((t) => (
      <button
        key={t}
        type="button"
        role="radio"
        aria-checked={value === t}
        onClick={() => onChange(t)}
        title={t === "casual" ? "Natural, everyday wording" : "Polite, professional wording"}
        className={`h-8 rounded-full px-3 text-[13px] font-medium capitalize transition-colors ${
          value === t ? "bg-raised text-fg shadow-card" : "text-muted hover:text-fg"
        }`}
      >
        {t}
      </button>
    ))}
  </div>
);

const LanguageBar: React.FC<Props> = ({ sourceLang, targetLang, detected, autoHint, tone, onSource, onTarget, onSwap, onTone }) => {
  const [turns, setTurns] = useState(0);
  const canSwap = sourceLang !== AUTO || Boolean(detected);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:gap-3">
      <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
        <LanguagePicker
          label="Speak in"
          value={sourceLang}
          onChange={onSource}
          allowAuto
          autoHint={autoHint}
          detected={detected}
        />
        <button
          type="button"
          onClick={() => {
            setTurns((n) => n + 1);
            onSwap();
          }}
          disabled={!canSwap}
          aria-label="Swap languages"
          title={canSwap ? "Swap languages (S) to let the other person reply" : "Speak or type first so the language is known"}
          className="icon-btn h-10 w-10 rounded-full"
        >
          <ArrowsRightLeftIcon className="h-4 w-4 transition-transform duration-300" style={{ transform: `rotate(${turns * 180}deg)` }} />
        </button>
        <LanguagePicker label="Translate to" value={targetLang} onChange={onTarget} align="right" />
      </div>
      <div className="hidden sm:block">
        <ToneToggle value={tone} onChange={onTone} />
      </div>
    </div>
  );
};

export default LanguageBar;
