import React, { useEffect, useRef } from "react";
import { LanguageIcon } from "@heroicons/react/24/outline";
import UtteranceCard, { InterimCard } from "./UtteranceCard";
import type { MicState, Utterance } from "../types";

const SAMPLES = [
  "Could we move tomorrow's meeting to Friday afternoon?",
  "I'm allergic to peanuts. Is there any in this dish?",
  "Sorry, my train is running about ten minutes late.",
];

type Props = {
  utterances: Utterance[];
  interim: string;
  micState: MicState;
  sourceLang: string;
  aiOn: boolean;
  onRetry: (u: Utterance) => void;
  onSample: (text: string) => void;
};

const Timeline: React.FC<Props> = ({ utterances, interim, micState, sourceLang, aiOn, onRetry, onSample }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const showInterim = micState === "listening" || (micState === "connecting" && Boolean(interim));
  const last = utterances[utterances.length - 1];

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [utterances.length, last?.status, interim, showInterim]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const empty = utterances.length === 0 && !showInterim;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="scroll-area min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
        {empty ? (
          <div className="m-auto flex max-w-md flex-col items-center py-8 text-center">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-accent shadow-card">
              <LanguageIcon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Speak or type to translate</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {aiOn
                ? "Each line is translated by Gemini with the last few turns as context, so names, pronouns and tone carry over."
                : "Each line is translated as soon as you finish it. Tap the mic, or try a phrase:"}
            </p>
            <div className="mt-5 flex flex-col items-stretch gap-2 sm:items-center">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSample(s)}
                  className="rounded-full border border-line bg-surface px-3.5 py-2 text-left text-sm text-muted shadow-card transition-colors hover:border-accent/40 hover:text-fg sm:text-center"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {utterances.map((u) => (
              <UtteranceCard key={u.id} u={u} onRetry={onRetry} />
            ))}
            {showInterim && <InterimCard text={interim} sourceLang={sourceLang} />}
          </>
        )}
      </div>
    </div>
  );
};

export default Timeline;
