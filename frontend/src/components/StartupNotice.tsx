import React, { useEffect, useState } from "react";

type Props = { phase: "waking" | "ready" | "offline"; onRetry: () => void };

const SHOW_AFTER_MS = 1200;
const TYPICAL_MS = 45000;

/**
 * Free hosting sleeps when idle, so the first request after a quiet spell can
 * take up to a minute. Show that as progress rather than an error.
 */
const StartupNotice: React.FC<Props> = ({ phase, onRetry }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== "waking") {
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    const t = window.setInterval(() => setElapsed(Date.now() - started), 250);
    return () => window.clearInterval(t);
  }, [phase]);

  if (phase === "offline") {
    return (
      <div role="status" className="mb-3 flex animate-fade-up items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-card">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
        <span className="flex-1 text-muted">Can't connect right now. Check your connection.</span>
        <button type="button" onClick={onRetry} className="font-medium text-fg underline-offset-2 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (phase !== "waking" || elapsed < SHOW_AFTER_MS) return null;

  const progress = Math.min(0.92, 1 - Math.exp(-elapsed / (TYPICAL_MS / 2.2)));
  return (
    <div role="status" aria-live="polite" className="mb-3 animate-fade-up rounded-xl border border-line bg-surface px-3.5 py-3 shadow-card">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-fg">Starting up</span>
        <span className="text-xs text-subtle">usually under a minute</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">You can start typing now. Translations will appear as soon as it's ready.</p>
    </div>
  );
};

export const TopProgress: React.FC<{ active: boolean }> = ({ active }) =>
  active ? (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden" aria-hidden="true">
      <div className="h-full w-1/3 animate-indeterminate rounded-full bg-accent" />
    </div>
  ) : null;

export default StartupNotice;
