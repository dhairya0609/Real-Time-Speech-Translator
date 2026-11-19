import React, { useEffect, useRef, useState } from "react";
import { ArrowDownTrayIcon, MoonIcon, SunIcon, TrashIcon } from "@heroicons/react/20/solid";
import { SparklesIcon } from "@heroicons/react/16/solid";
import type { ServerStatus } from "../lib/api";

export type ServerState = { phase: "waking" | "ready" | "offline"; status: ServerStatus | null };

type Props = {
  server: ServerState;
  theme: "light" | "dark";
  hasContent: boolean;
  onToggleTheme: () => void;
  onSummarize: () => void;
  onExport: (format: "md" | "txt") => void;
  onClear: () => void;
  onRetryServer: () => void;
  mobileExtra?: React.ReactNode;
};

function prettyModel(model: string) {
  return model
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

const Logo = () => (
  <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
    <rect width="32" height="32" rx="8" className="fill-fg" />
    <g className="fill-bg">
      <rect x="7" y="13" width="3" height="6" rx="1.5" />
      <rect x="12" y="9" width="3" height="14" rx="1.5" />
      <rect x="17" y="11" width="3" height="10" rx="1.5" />
    </g>
    <rect x="22" y="14" width="3" height="4" rx="1.5" fill="rgb(var(--accent))" />
  </svg>
);

const ServerBadge: React.FC<{ server: ServerState; onRetry: () => void }> = ({ server, onRetry }) => {
  const { phase, status } = server;
  let dot = "bg-subtle";
  let label = "Waking server";
  let title = "Free hosting sleeps when idle; the first load can take up to a minute.";
  if (phase === "offline") {
    dot = "bg-danger";
    label = "Server offline";
    title = "Couldn't reach the server. Click to retry.";
  } else if (phase === "ready" && status) {
    if (status.ai && status.aiAvailable) {
      dot = "bg-accent";
      label = status.model ? prettyModel(status.model) : "Gemini";
      title = "AI translation with conversation context. Falls back to classic translation if the AI is unavailable.";
    } else if (status.ai) {
      dot = "bg-amber-500";
      label = "AI paused";
      title = "The AI quota is used up for now; using classic translation.";
    } else {
      dot = "bg-subtle";
      label = "Classic translation";
      title = "AI translation isn't configured on the server.";
    }
  }
  return (
    <button
      type="button"
      onClick={phase === "offline" ? onRetry : undefined}
      title={title}
      className="flex h-8 min-w-0 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-medium text-muted"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {phase === "waking" && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-70`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
};

const ExportMenu: React.FC<{ disabled: boolean; onExport: (f: "md" | "txt") => void }> = ({ disabled, onExport }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="icon-btn"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export transcript"
        title="Export transcript"
      >
        <ArrowDownTrayIcon className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-52 animate-fade-in rounded-xl border border-line bg-surface p-1 shadow-pop">
          {(
            [
              ["md", "Markdown", ".md"],
              ["txt", "Plain text", ".txt"],
            ] as const
          ).map(([f, label, ext]) => (
            <button
              key={f}
              role="menuitem"
              type="button"
              onClick={() => {
                onExport(f);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-raised"
            >
              {label}
              <span className="font-mono text-[11px] text-subtle">{ext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Header: React.FC<Props> = ({ server, theme, hasContent, onToggleTheme, onSummarize, onExport, onClear, onRetryServer, mobileExtra }) => (
  <header className="border-b border-line bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
    <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
      <Logo />
      <h1 className="truncate text-[15px] font-semibold tracking-tight">Live Translator</h1>
      <div className="ml-1 hidden min-w-0 sm:block">
        <ServerBadge server={server} onRetry={onRetryServer} />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <button type="button" onClick={onSummarize} disabled={!hasContent} className="btn h-9 px-2.5 sm:px-3" title="Summarize with AI">
          <SparklesIcon className="h-4 w-4 text-accent" />
          <span className="hidden sm:inline">Summarize</span>
        </button>
        <ExportMenu disabled={!hasContent} onExport={onExport} />
        <button type="button" onClick={onClear} disabled={!hasContent} className="icon-btn" aria-label="Clear conversation" title="Clear conversation">
          <TrashIcon className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="icon-btn"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
        >
          {theme === "dark" ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
    <div className="flex items-center justify-between gap-2 px-4 pb-2.5 sm:hidden">
      <div className="min-w-0">
        <ServerBadge server={server} onRetry={onRetryServer} />
      </div>
      {mobileExtra}
    </div>
  </header>
);

export default Header;
