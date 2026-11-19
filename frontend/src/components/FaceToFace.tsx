import React, { useEffect, useRef, useState } from "react";
import { ArrowUpIcon, MicrophoneIcon, StopIcon, XMarkIcon } from "@heroicons/react/20/solid";
import Translation from "./Translation";
import type { MicState, Utterance } from "../types";
import { languageName } from "../lib/languages";

type Side = "a" | "b";

type Props = {
  utterances: Utterance[];
  interim: string;
  micState: MicState;
  speaker: Side;
  langA: string;
  langB: string;
  showRoman: boolean;
  micDisabled: boolean;
  onTalk: (side: Side) => void;
  onType: (side: Side, text: string) => void;
  onExit: () => void;
};

function endonym(code: string) {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code.split("-")[0]);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : languageName(code);
  } catch {
    return languageName(code);
  }
}

const Half: React.FC<Props & { side: Side }> = ({ side, utterances, interim, micState, speaker, langA, langB, showRoman, micDisabled, onTalk, onType, onExit }) => {
  const lang = side === "a" ? langA : langB;
  const mine = speaker === side;
  const active = mine && (micState === "listening" || micState === "connecting");
  const otherListening = !mine && micState === "listening";
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [utterances, interim]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onType(side, t);
    setText("");
  };

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col ${side === "b" ? "rotate-180 border-b border-line bg-raised/40" : "bg-surface"}`}
      aria-label={`${languageName(lang)} side`}
    >
      <header className="flex items-center gap-2 px-4 pt-3">
        <span className="rounded-full bg-surface px-3 py-1 text-sm font-semibold shadow-card ring-1 ring-line" lang={lang}>
          {endonym(lang)}
        </span>
        {side === "a" && (
          <button type="button" onClick={onExit} className="btn ml-auto h-8 px-2.5 text-xs" aria-label="Exit face to face">
            <XMarkIcon className="h-4 w-4" /> Exit
          </button>
        )}
      </header>

      <div ref={listRef} className="scroll-area flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {utterances.length === 0 && !active && (
          <p className="m-auto text-center text-sm text-muted">
            <MicrophoneIcon className="mx-auto mb-2 h-6 w-6 text-subtle" />
            {endonym(lang)}
          </p>
        )}
        {utterances.map((u) => {
          const own = u.speaker === side;
          if (own) {
            return (
              <p key={u.id} className="max-w-[85%] self-end rounded-2xl bg-raised px-3 py-2 text-sm text-muted" lang={lang}>
                {u.original}
              </p>
            );
          }
          return (
            <div key={u.id} className="max-w-[92%] animate-card-in self-start text-2xl font-semibold leading-snug tracking-[-0.01em] text-fg sm:text-3xl">
              {u.status === "done" && u.translated ? (
                <Translation text={u.translated} lang={lang} romanized={u.romanized} showRoman={showRoman} romanClassName="mt-0.5 text-base font-normal tracking-normal" />
              ) : u.status === "failed" ? (
                <span className="text-base font-normal text-muted">…</span>
              ) : (
                <span className="inline-flex gap-1 py-3" aria-label="Translating">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-subtle" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
        {active && (
          <p className="max-w-[85%] self-end rounded-2xl border border-dashed border-accent/40 px-3 py-2 text-sm text-fg" lang={lang}>
            {interim || "…"}
            <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-caret bg-accent" />
          </p>
        )}
        {otherListening && (
          <span className="inline-flex gap-1 self-start py-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent/60" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 pb-4 pt-1">
        <form onSubmit={send} className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-line bg-surface py-1 pl-4 pr-1 shadow-card focus-within:border-accent/50">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Aa"
            aria-label={`Type in ${languageName(lang)}`}
            lang={lang}
            className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
          />
          <button type="submit" disabled={!text.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fg text-bg disabled:opacity-25" aria-label="Translate">
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        </form>
        <button
          type="button"
          onClick={() => onTalk(side)}
          disabled={micDisabled || micState === "processing"}
          aria-label={active ? `Stop listening to ${languageName(lang)}` : `Speak ${languageName(lang)}`}
          className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-40 ${
            active ? "bg-accent text-accent-fg" : "bg-fg text-bg"
          }`}
        >
          {active && <span className="absolute inset-0 animate-ring rounded-full bg-accent/40" />}
          {active ? <StopIcon className="relative h-6 w-6" /> : <MicrophoneIcon className="h-7 w-7" />}
        </button>
      </div>
    </section>
  );
};

/** Phone flat on the table: the other person reads the top half, which is rotated to face them. */
const FaceToFace: React.FC<Props> = (props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onExit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="fixed inset-0 z-[65] flex animate-fade-in flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]" role="dialog" aria-modal="true" aria-label="Face to face conversation">
      <Half {...props} side="b" />
      <Half {...props} side="a" />
    </div>
  );
};

export default FaceToFace;
