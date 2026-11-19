import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { SparklesIcon } from "@heroicons/react/16/solid";
import { AUTO, LANGUAGES, languageName, shortCode } from "../lib/languages";

type Props = {
  value: string;
  onChange: (code: string) => void;
  label: string;
  allowAuto?: boolean;
  autoHint?: string;
  detected?: string;
  align?: "left" | "right";
};

type Option = { code: string; name: string };

const LanguagePicker: React.FC<Props> = ({ value, onChange, label, allowAuto, autoHint, detected, align = "left" }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = `${label.replace(/\s+/g, "-").toLowerCase()}-list`;

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const all: Option[] = [...(allowAuto ? [{ code: AUTO, name: "Auto-detect" }] : []), ...LANGUAGES];
    if (!q) return all;
    return all.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().startsWith(q));
  }, [query, allowAuto]);

  useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, options.findIndex((o) => o.code === value)));
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) choose(options[active].code);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const isAuto = value === AUTO;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:flex-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${languageName(value)}`}
        className="flex h-10 w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface pl-2 pr-3 text-sm font-medium shadow-card transition-colors hover:bg-raised sm:w-auto sm:min-w-[11rem]"
      >
        <span
          className={`grid h-6 min-w-[2.25rem] shrink-0 max-[379px]:hidden place-items-center rounded-full px-1.5 font-mono text-[11px] font-medium ${
            isAuto ? "bg-accent/10 text-accent" : "bg-raised text-muted"
          }`}
        >
          {isAuto ? <SparklesIcon className="h-3.5 w-3.5" /> : shortCode(value)}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">
          {isAuto && detected ? (
            <>
              Auto <span className="text-muted">· {languageName(detected)}</span>
            </>
          ) : (
            languageName(value)
          )}
        </span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute top-12 z-40 w-[min(18rem,calc(100vw-2rem))] origin-top animate-fade-in overflow-hidden rounded-xl border border-line bg-surface shadow-pop ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-line px-3">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-subtle" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search languages"
              role="combobox"
              aria-controls={listId}
              aria-expanded="true"
              aria-activedescendant={options[active] ? `${listId}-${options[active].code}` : undefined}
              className="h-11 w-full bg-transparent text-base outline-none placeholder:text-subtle sm:text-sm"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="scroll-area max-h-72 overflow-y-auto p-1">
            {options.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No match</li>}
            {options.map((o, i) => (
              <li
                key={o.code}
                id={`${listId}-${o.code}`}
                data-index={i}
                role="option"
                aria-selected={o.code === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.code)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${
                  i === active ? "bg-raised" : ""
                }`}
              >
                <span className="w-9 shrink-0 font-mono text-[11px] text-subtle">
                  {o.code === AUTO ? <SparklesIcon className="h-3.5 w-3.5 text-accent" /> : shortCode(o.code)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.name}</span>
                  {o.code === AUTO && autoHint && <span className="block truncate text-xs text-muted">{autoHint}</span>}
                </span>
                {o.code === value && <CheckIcon className="h-4 w-4 shrink-0 text-accent" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LanguagePicker;
