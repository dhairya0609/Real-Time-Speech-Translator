import React, { useEffect, useRef } from "react";
import { LogoMark } from "./Logo";
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
  speaker: "a" | "b";
  showRoman: boolean;
  aiOn: boolean;
  isSaved: (original: string, translated: string) => boolean;
  onRetry: (u: Utterance) => void;
  onSample: (text: string) => void;
  onToggleSave: (u: Utterance) => void;
  onAlternatives: (u: Utterance) => void;
  onShow: (u: Utterance) => void;
};

const Timeline: React.FC<Props> = ({
  utterances, interim, micState, sourceLang, speaker, showRoman, aiOn, isSaved, onRetry, onSample, onToggleSave, onAlternatives, onShow,
}) => {
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
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6 sm:py-6">
        {empty ? (
          <div className="m-auto flex w-full max-w-md animate-fade-up flex-col items-center py-6 text-center">
            <LogoMark className="mb-5 h-12 w-12 rounded-[14px] shadow-[0_10px_30px_-10px_rgb(var(--accent)/0.6)]" />
            <h2 className="text-balance text-xl font-semibold tracking-[-0.02em] sm:text-2xl">Speak naturally. Be understood.</h2>
            <p className="mt-2 text-balance text-[15px] leading-relaxed text-muted">
              Live translation that keeps track of the conversation, not just the words.
            </p>
            <p className="mb-2.5 mt-7 text-xs font-medium uppercase tracking-wider text-subtle">Try a phrase</p>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-center">
              {SAMPLES.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSample(s)}
                  style={{ animationDelay: `${80 + i * 60}ms` }}
                  className="animate-fade-up rounded-xl border border-line bg-surface px-4 py-2.5 text-left text-sm text-muted shadow-card transition-colors hover:border-accent/40 hover:text-fg sm:rounded-full sm:text-center"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {utterances.map((u) => (
              <UtteranceCard
                key={u.id}
                u={u}
                showRoman={showRoman}
                aiOn={aiOn}
                saved={Boolean(u.translated) && isSaved(u.original, u.translated!)}
                onRetry={onRetry}
                onToggleSave={onToggleSave}
                onAlternatives={onAlternatives}
                onShow={onShow}
              />
            ))}
            {showInterim && <InterimCard text={interim} sourceLang={sourceLang} other={speaker === "b"} />}
          </>
        )}
      </div>
    </div>
  );
};

export default Timeline;
