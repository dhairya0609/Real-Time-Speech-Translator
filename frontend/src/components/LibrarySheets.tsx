import React from "react";
import { ClipboardDocumentIcon, SpeakerWaveIcon, TrashIcon } from "@heroicons/react/16/solid";
import { ClockIcon, StarIcon } from "@heroicons/react/24/outline";
import Sheet from "./Sheet";
import Translation from "./Translation";
import type { Saved, StoredConversation } from "../types";
import { AUTO, languageName, shortCode } from "../lib/languages";
import { canSpeak, speak } from "../lib/voices";

const Empty: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex flex-col items-center py-8 text-center">
    <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-raised text-muted">{icon}</span>
    <p className="font-medium text-fg">{title}</p>
    <p className="mt-1 max-w-xs">{children}</p>
  </div>
);

export const SavedSheet: React.FC<{
  open: boolean;
  items: Saved[];
  showRoman: boolean;
  onRemove: (id: string) => void;
  onClose: () => void;
}> = ({ open, items, showRoman, onRemove, onClose }) => (
  <Sheet open={open} onClose={onClose} title="Saved phrases">
    {items.length === 0 ? (
      <Empty icon={<StarIcon className="h-5 w-5" />} title="Nothing saved yet">
        Tap the star on any translation to keep it here for next time.
      </Empty>
    ) : (
      <ul className="-mx-2 divide-y divide-line">
        {items.map((s) => (
          <li key={s.id} className="group flex gap-2 px-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-subtle">
                {shortCode(s.sourceLang)} → {shortCode(s.targetLang)}
              </p>
              <p className="mt-0.5 text-sm">{s.original}</p>
              <p className="mt-1 text-base font-medium text-fg">
                <Translation text={s.translated} lang={s.targetLang} romanized={s.romanized} showRoman={showRoman} romanClassName="mt-0.5 text-sm font-normal" />
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center">
              {canSpeak(s.targetLang) && (
                <button type="button" className="icon-btn h-8 w-8" aria-label="Listen" onClick={() => speak(s.translated, s.targetLang)}>
                  <SpeakerWaveIcon className="h-4 w-4" />
                </button>
              )}
              <button type="button" className="icon-btn h-8 w-8" aria-label="Copy" onClick={() => navigator.clipboard?.writeText(s.translated).catch(() => undefined)}>
                <ClipboardDocumentIcon className="h-4 w-4" />
              </button>
              <button type="button" className="icon-btn h-8 w-8" aria-label="Remove from saved" onClick={() => onRemove(s.id)}>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}
    <p className="mt-4 text-xs text-subtle">Saved phrases are stored only in this browser.</p>
  </Sheet>
);

function when(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const HistorySheet: React.FC<{
  open: boolean;
  items: StoredConversation[];
  currentId: string;
  keep: boolean;
  onKeep: (on: boolean) => void;
  onOpen: (c: StoredConversation) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}> = ({ open, items, currentId, keep, onKeep, onOpen, onDelete, onClearAll, onClose }) => (
  <Sheet
    open={open}
    onClose={onClose}
    title="History"
    footer={
      items.length > 0 ? (
        <button type="button" className="btn text-danger" onClick={onClearAll}>
          <TrashIcon className="h-4 w-4" /> Delete all
        </button>
      ) : undefined
    }
  >
    <label className="mb-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line px-3.5 py-3">
      <span>
        <span className="block font-medium text-fg">Keep history on this device</span>
        <span className="block text-xs">Conversations are saved in this browser only, never on a server.</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={keep} onChange={(e) => onKeep(e.target.checked)} />
      <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${keep ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${keep ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </label>
    {items.length === 0 ? (
      <Empty icon={<ClockIcon className="h-5 w-5" />} title={keep ? "No past conversations" : "History is off"}>
        {keep ? "Conversations you have here will show up so you can pick them up again." : "Turn it on to come back to past conversations."}
      </Empty>
    ) : (
      <ul className="-mx-2 divide-y divide-line">
        {items.map((c) => {
          const first = c.utterances[0];
          const src = c.sourceLang === AUTO ? first?.detectedLang || AUTO : c.sourceLang;
          return (
            <li key={c.id} className="flex items-center gap-2 px-2 py-1">
              <button type="button" onClick={() => onOpen(c)} className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-raised">
                <span className="flex items-center gap-2 text-xs text-subtle">
                  {when(c.updatedAt)} · {languageName(src)} ↔ {languageName(c.targetLang)}
                  {c.id === currentId && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 font-medium text-accent">Open</span>}
                </span>
                <span className="mt-0.5 block truncate text-sm text-fg">{first?.original}</span>
                <span className="block text-xs">{c.utterances.length} {c.utterances.length === 1 ? "line" : "lines"}</span>
              </button>
              <button type="button" className="icon-btn h-8 w-8" aria-label="Delete conversation" onClick={() => onDelete(c.id)}>
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </Sheet>
);
