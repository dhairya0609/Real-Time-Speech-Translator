import React, { useEffect, useRef, useState } from "react";
import { ArrowPathIcon, CheckIcon, ClipboardDocumentIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { XMarkIcon } from "@heroicons/react/20/solid";
import type { Summary } from "../types";
import { languageName } from "../lib/languages";

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  summary: Summary | null;
  stale: boolean;
  canRetry: boolean;
  onClose: () => void;
  onRegenerate: () => void;
};

const SummaryPanel: React.FC<Props> = ({ open, loading, error, summary, stale, canRetry, onClose, onRegenerate }) => {
  const [side, setSide] = useState<"source" | "target">("target");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const current = summary ? summary[side] : null;
  const tabs = summary
    ? ([
        ["source", summary.sourceLang],
        ["target", summary.targetLang],
      ] as const)
    : [];

  const copy = async () => {
    if (!current) return;
    const text = [current.summary, ...current.actionItems.map((a) => `- ${a}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="summary-title">
      <div className="absolute inset-0 animate-fade-in bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <section
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] animate-sheet-up flex-col rounded-t-2xl border-t border-line bg-surface shadow-pop
          md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:animate-sheet-in md:rounded-none md:border-l md:border-t-0"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
        <header className="flex items-center gap-2 px-5 pb-3 pt-3 md:pt-5">
          <SparklesIcon className="h-4 w-4 text-accent" />
          <h2 id="summary-title" className="text-base font-semibold tracking-tight">
            Summary
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className="icon-btn ml-auto" aria-label="Close summary">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        {summary && (
          <div role="tablist" aria-label="Summary language" className="mx-5 mb-4 flex rounded-lg bg-raised p-1">
            {tabs.map(([key, lang]) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={side === key}
                onClick={() => setSide(key)}
                className={`h-8 flex-1 truncate rounded-md px-2 text-[13px] font-medium transition-colors ${
                  side === key ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"
                }`}
              >
                {languageName(lang)}
              </button>
            ))}
          </div>
        )}

        <div className="scroll-area flex-1 overflow-y-auto px-5 pb-5">
          {loading && (
            <div className="space-y-3 py-1" aria-label="Summarizing">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-11/12" />
              <div className="skeleton h-4 w-3/5" />
              <div className="skeleton mt-6 h-3 w-24" />
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-line bg-raised/60 p-4 text-sm leading-relaxed text-muted">
              <p className="font-medium text-fg">Couldn't summarize</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && current && (
            <div className="animate-fade-in" lang={side === "source" ? summary!.sourceLang : summary!.targetLang}>
              <p className="text-[15px] leading-relaxed text-fg">{current.summary}</p>
              <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-subtle">Action items</h3>
              {current.actionItems.length ? (
                <ul className="space-y-2">
                  {current.actionItems.map((a, i) => (
                    <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                      <span className="mt-[7px] h-3.5 w-3.5 shrink-0 rounded border border-line" aria-hidden="true" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">None mentioned.</p>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {stale && !loading && summary && <span className="text-xs text-muted">New lines since this summary</span>}
          <div className="ml-auto flex gap-2">
            {current && !loading && (
              <button type="button" onClick={copy} className="btn">
                {copied ? <CheckIcon className="h-4 w-4 text-accent" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                Copy
              </button>
            )}
            {canRetry && (
              <button type="button" onClick={onRegenerate} disabled={loading} className="btn">
                <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {summary ? "Regenerate" : "Try again"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
};

export default SummaryPanel;
