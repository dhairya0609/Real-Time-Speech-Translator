import React, { useEffect, useRef } from "react";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/24/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import type { MicState } from "../types";

type Props = {
  state: MicState;
  analyser: AnalyserNode | null;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

const LABEL: Record<MicState, string> = {
  idle: "Start listening",
  connecting: "Connecting, tap to cancel",
  listening: "Stop listening",
  processing: "Finishing translation",
  error: "Try the microphone again",
};

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={`animate-spin ${className || ""}`} aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
    <path d="M22 12a10 10 0 0 0-10-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MicButton: React.FC<Props> = ({ state, analyser, disabled, disabledReason, onClick }) => {
  const haloRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (state !== "listening" || !analyser) return undefined;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const loop = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = Math.min(1, (sum / data.length / 255) * 3.2);
      if (haloRef.current) haloRef.current.style.transform = `scale(${1 + level * 0.45})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state, analyser]);

  const base =
    "relative z-10 grid h-16 w-16 place-items-center rounded-full transition-all duration-200 ease-out focus-visible:outline-offset-4 active:scale-95";
  const tone: Record<MicState, string> = {
    idle: "bg-accent text-accent-fg shadow-[0_8px_24px_-6px_rgb(var(--accent)/0.55)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-6px_rgb(var(--accent)/0.6)]",
    connecting: "bg-surface text-accent ring-1 ring-inset ring-accent/40",
    listening: "bg-accent text-accent-fg shadow-[0_8px_24px_-6px_rgb(var(--accent)/0.55)]",
    processing: "bg-surface text-muted ring-1 ring-inset ring-line",
    error: "bg-surface text-danger ring-1 ring-inset ring-danger/50 hover:bg-danger/5",
  };

  return (
    <div className="relative grid place-items-center">
      {state === "listening" && (
        <>
          <span ref={haloRef} className="absolute h-16 w-16 rounded-full bg-accent/20 transition-transform duration-75" />
          <span className="absolute h-16 w-16 animate-ring rounded-full bg-accent/30" />
        </>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || state === "processing"}
        aria-label={disabled ? disabledReason : LABEL[state]}
        title={disabled ? disabledReason : LABEL[state]}
        data-state={state}
        className={`${base} ${tone[state]} disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0`}
      >
        {state === "connecting" && <Spinner className="absolute inset-0 h-16 w-16 p-0.5" />}
        {state === "processing" ? (
          <Spinner className="h-6 w-6" />
        ) : state === "listening" ? (
          <StopIcon className="h-6 w-6" />
        ) : (
          <MicrophoneIcon className="h-7 w-7" />
        )}
        {state === "error" && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-white ring-2 ring-surface">
            <ExclamationTriangleIcon className="h-3 w-3" />
          </span>
        )}
      </button>
    </div>
  );
};

export default MicButton;
