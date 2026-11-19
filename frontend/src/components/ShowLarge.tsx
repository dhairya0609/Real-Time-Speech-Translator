import React, { useEffect, useState } from "react";
import { ArrowPathRoundedSquareIcon, SpeakerWaveIcon, XMarkIcon } from "@heroicons/react/20/solid";
import Translation from "./Translation";
import { languageName } from "../lib/languages";
import { canSpeak, speak } from "../lib/voices";

export type ShowItem = { text: string; romanized?: string; lang: string; original: string } | null;

/** Full-screen, large-type card to hand the phone to someone. */
const ShowLarge: React.FC<{ item: ShowItem; showRoman: boolean; onClose: () => void }> = ({ item, showRoman, onClose }) => {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!item) return undefined;
    setFlipped(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;
  const long = item.text.length > 120;

  return (
    <div className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-surface" role="dialog" aria-modal="true" aria-label="Translation shown full screen">
      <div className={`flex flex-1 flex-col justify-center overflow-y-auto px-6 py-10 transition-transform duration-500 sm:px-16 ${flipped ? "rotate-180" : ""}`}>
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-subtle">{languageName(item.lang)}</p>
        <div className={`text-balance font-semibold leading-tight tracking-[-0.02em] text-fg ${long ? "text-3xl sm:text-5xl" : "text-4xl sm:text-7xl"}`}>
          <Translation text={item.text} lang={item.lang} romanized={item.romanized} showRoman={showRoman} romanClassName="mt-4 text-xl font-normal tracking-normal sm:text-3xl" />
        </div>
        <p className="mt-8 text-base text-muted">{item.original}</p>
      </div>
      <div className="flex items-center justify-center gap-3 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" className="btn h-11 px-4" onClick={() => setFlipped((f) => !f)}>
          <ArrowPathRoundedSquareIcon className="h-5 w-5" /> Flip
        </button>
        {canSpeak(item.lang) && (
          <button type="button" className="btn h-11 px-4" onClick={() => speak(item.text, item.lang)}>
            <SpeakerWaveIcon className="h-5 w-5" /> Listen
          </button>
        )}
        <button type="button" className="btn-primary h-11 px-4" onClick={onClose} data-autofocus>
          <XMarkIcon className="h-5 w-5" /> Done
        </button>
      </div>
    </div>
  );
};

export default ShowLarge;
