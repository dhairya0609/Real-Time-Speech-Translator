import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  ChatBubbleBottomCenterTextIcon,
  CommandLineIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  InformationCircleIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { SparklesIcon } from "@heroicons/react/16/solid";
import Logo from "./Logo";
import type { Tone } from "../types";

type MenuProps = {
  hasContent: boolean;
  tone: Tone;
  onTone: (t: Tone) => void;
  onExport: (format: "md" | "txt") => void;
  onClear: () => void;
  onShortcuts: () => void;
  onAbout: () => void;
};

type Props = MenuProps & {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSummarize: () => void;
};

const MoreMenu: React.FC<MenuProps> = ({ hasContent, tone, onTone, onExport, onClear, onShortcuts, onAbout }) => {
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

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More options"
        title="More options"
      >
        <EllipsisHorizontalIcon className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-64 origin-top-right animate-pop rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <button
            role="menuitemcheckbox"
            aria-checked={tone === "formal"}
            type="button"
            className="menu-item sm:hidden"
            onClick={() => onTone(tone === "formal" ? "casual" : "formal")}
          >
            <ChatBubbleBottomCenterTextIcon className="h-4 w-4 text-subtle" />
            <span className="flex-1">Formal tone</span>
            <span className={`relative h-5 w-9 rounded-full transition-colors ${tone === "formal" ? "bg-accent" : "bg-line"}`}>
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${tone === "formal" ? "translate-x-[18px]" : "translate-x-0.5"}`}
              />
            </span>
          </button>
          <div className="my-1.5 h-px bg-line sm:hidden" />
          <button role="menuitem" type="button" className="menu-item" disabled={!hasContent} onClick={run(() => onExport("md"))}>
            <ArrowDownTrayIcon className="h-4 w-4 text-subtle" />
            <span className="flex-1">Export as Markdown</span>
          </button>
          <button role="menuitem" type="button" className="menu-item" disabled={!hasContent} onClick={run(() => onExport("txt"))}>
            <DocumentTextIcon className="h-4 w-4 text-subtle" />
            <span className="flex-1">Export as text</span>
          </button>
          <button role="menuitem" type="button" className="menu-item" disabled={!hasContent} onClick={run(onClear)}>
            <TrashIcon className="h-4 w-4 text-subtle" />
            <span className="flex-1">Clear conversation</span>
          </button>
          <div className="my-1.5 h-px bg-line" />
          <button role="menuitem" type="button" className="menu-item max-sm:hidden" onClick={run(onShortcuts)}>
            <CommandLineIcon className="h-4 w-4 text-subtle" />
            <span className="flex-1">Keyboard shortcuts</span>
            <kbd className="font-mono text-[11px] text-subtle">?</kbd>
          </button>
          <button role="menuitem" type="button" className="menu-item" onClick={run(onAbout)}>
            <InformationCircleIcon className="h-4 w-4 text-subtle" />
            <span className="flex-1">About and privacy</span>
          </button>
        </div>
      )}
    </div>
  );
};

const Header: React.FC<Props> = ({ theme, onToggleTheme, onSummarize, ...menu }) => (
  <header className="relative z-30 border-b border-line bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
    <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
      <Logo />
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <button type="button" onClick={onSummarize} disabled={!menu.hasContent} className="btn h-9 px-2.5 sm:px-3" title="Summarize the conversation">
          <SparklesIcon className="h-4 w-4 text-accent" />
          <span className="hidden sm:inline">Summarize</span>
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
        <MoreMenu {...menu} />
      </div>
    </div>
  </header>
);

export default Header;
