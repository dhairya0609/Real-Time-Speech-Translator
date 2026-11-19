import React, { useRef, useState } from "react";
import {
  ArrowDownTrayIcon,
  ChatBubbleBottomCenterTextIcon,
  ClockIcon,
  CommandLineIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  InformationCircleIcon,
  LanguageIcon,
  MoonIcon,
  PencilSquareIcon,
  StarIcon,
  SunIcon,
} from "@heroicons/react/20/solid";
import { ChatBubbleLeftRightIcon, DocumentTextIcon as DocOutline, SparklesIcon } from "@heroicons/react/16/solid";
import Logo, { LogoMark } from "./Logo";
import Popover from "./Popover";
import { FaceToFaceIcon } from "./icons";
import type { Tone } from "../types";

export type View = "conversation" | "text";

type Props = {
  view: View;
  onView: (v: View) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  hasContent: boolean;
  savedCount: number;
  tone: Tone;
  onTone: (t: Tone) => void;
  showRoman: boolean;
  onShowRoman: (on: boolean) => void;
  onSummarize: () => void;
  onExport: (format: "md" | "txt") => void;
  onNew: () => void;
  onSaved: () => void;
  onHistory: () => void;
  onFaceToFace: () => void;
  onShortcuts: () => void;
  onAbout: () => void;
};

const Toggle: React.FC<{ on: boolean }> = ({ on }) => (
  <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
  </span>
);

export const ViewSwitch: React.FC<{ view: View; onView: (v: View) => void }> = ({ view, onView }) => (
  <div role="tablist" aria-label="Mode" className="flex h-9 items-center rounded-full border border-line bg-surface p-0.5 shadow-card">
    {(
      [
        ["conversation", "Conversation", ChatBubbleLeftRightIcon],
        ["text", "Text", DocOutline],
      ] as const
    ).map(([v, label, Icon]) => (
      <button
        key={v}
        role="tab"
        type="button"
        aria-selected={view === v}
        onClick={() => onView(v)}
        className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
          view === v ? "bg-raised text-fg shadow-card ring-1 ring-line" : "text-muted hover:text-fg"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    ))}
  </div>
);

const Header: React.FC<Props> = (p) => {
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const conversation = p.view === "conversation";

  return (
    <header className="relative z-30 border-b border-line bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <div className="min-[420px]:hidden">
          <LogoMark />
        </div>
        <div className="hidden min-w-0 min-[420px]:block md:w-56">
          <Logo />
        </div>
        <div className="mx-auto">
          <ViewSwitch view={p.view} onView={p.onView} />
        </div>
        <div className="flex items-center justify-end gap-1 md:w-56">
          {conversation && (
            <button type="button" onClick={p.onSummarize} disabled={!p.hasContent} className="btn hidden h-9 px-3 lg:inline-flex" title="Summarize the conversation">
              <SparklesIcon className="h-4 w-4 text-accent" />
              Summarize
            </button>
          )}
          <button
            type="button"
            onClick={p.onToggleTheme}
            className="icon-btn max-sm:hidden"
            aria-label={p.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={p.theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {p.theme === "dark" ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
          </button>
          <button
            ref={moreRef}
            type="button"
            className="icon-btn"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Menu"
            title="Menu"
          >
            <EllipsisHorizontalIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <Popover anchor={moreRef.current} open={open} onClose={() => setOpen(false)} width={264}>
        {conversation && (
          <button role="menuitem" type="button" className="menu-item lg:hidden" disabled={!p.hasContent} onClick={run(p.onSummarize)}>
            <SparklesIcon className="h-4 w-4 text-accent" />
            <span className="flex-1">Summarize</span>
          </button>
        )}
        <button role="menuitemcheckbox" aria-checked={p.showRoman} type="button" className="menu-item" onClick={() => p.onShowRoman(!p.showRoman)}>
          <LanguageIcon className="h-4 w-4 text-subtle" />
          <span className="flex-1">Show pronunciation</span>
          <Toggle on={p.showRoman} />
        </button>
        <button
          role="menuitemcheckbox"
          aria-checked={p.tone === "formal"}
          type="button"
          className="menu-item sm:hidden"
          onClick={() => p.onTone(p.tone === "formal" ? "casual" : "formal")}
        >
          <ChatBubbleBottomCenterTextIcon className="h-4 w-4 text-subtle" />
          <span className="flex-1">Formal tone</span>
          <Toggle on={p.tone === "formal"} />
        </button>
        <button role="menuitemcheckbox" aria-checked={p.theme === "dark"} type="button" className="menu-item sm:hidden" onClick={p.onToggleTheme}>
          <MoonIcon className="h-4 w-4 text-subtle" />
          <span className="flex-1">Dark theme</span>
          <Toggle on={p.theme === "dark"} />
        </button>
        <div className="my-1.5 h-px bg-line" />
        <button role="menuitem" type="button" className="menu-item" onClick={run(p.onSaved)}>
          <StarIcon className="h-4 w-4 text-subtle" />
          <span className="flex-1">Saved phrases</span>
          {p.savedCount > 0 && <span className="text-xs tabular-nums text-subtle">{p.savedCount}</span>}
        </button>
        {conversation && (
          <button role="menuitem" type="button" className="menu-item" onClick={run(p.onFaceToFace)}>
            <FaceToFaceIcon className="h-4 w-4 text-subtle" />
            <span className="flex-1">Face to face</span>
          </button>
        )}
        <button role="menuitem" type="button" className="menu-item" onClick={run(p.onHistory)}>
          <ClockIcon className="h-4 w-4 text-subtle" />
          <span className="flex-1">History</span>
        </button>
        {conversation && (
          <>
            <button role="menuitem" type="button" className="menu-item" disabled={!p.hasContent} onClick={run(p.onNew)}>
              <PencilSquareIcon className="h-4 w-4 text-subtle" />
              <span className="flex-1">New conversation</span>
            </button>
            <button role="menuitem" type="button" className="menu-item" disabled={!p.hasContent} onClick={run(() => p.onExport("md"))}>
              <ArrowDownTrayIcon className="h-4 w-4 text-subtle" />
              <span className="flex-1">Export as Markdown</span>
            </button>
            <button role="menuitem" type="button" className="menu-item" disabled={!p.hasContent} onClick={run(() => p.onExport("txt"))}>
              <DocumentTextIcon className="h-4 w-4 text-subtle" />
              <span className="flex-1">Export as text</span>
            </button>
          </>
        )}
        <div className="my-1.5 h-px bg-line" />
        <button role="menuitem" type="button" className="menu-item max-sm:hidden" onClick={run(p.onShortcuts)}>
          <CommandLineIcon className="h-4 w-4 text-subtle" />
          <span className="flex-1">Keyboard shortcuts</span>
          <kbd className="font-mono text-[11px] text-subtle">?</kbd>
        </button>
        <button role="menuitem" type="button" className="menu-item" onClick={run(p.onAbout)}>
          <InformationCircleIcon className="h-4 w-4 text-subtle" />
          <span className="flex-1">About and privacy</span>
        </button>
      </Popover>
    </header>
  );
};

export default Header;
