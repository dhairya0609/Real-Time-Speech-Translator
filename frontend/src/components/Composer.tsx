import React, { forwardRef, useState } from "react";
import { ArrowUpIcon } from "@heroicons/react/20/solid";

type Props = {
  onSubmit: (text: string) => void;
  maxChars: number;
};

const Composer = forwardRef<HTMLTextAreaElement, Props>(({ onSubmit, maxChars }, ref) => {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const over = text.length > maxChars;

  const submit = () => {
    if (!trimmed || over) return;
    onSubmit(trimmed);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-4 shadow-card transition-colors focus-within:border-accent/50"
    >
      <label htmlFor="composer" className="sr-only">
        Type to translate
      </label>
      <textarea
        id="composer"
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Type to translate…"
        className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-base leading-snug outline-none placeholder:text-subtle sm:text-[15px]"
        style={{ fieldSizing: "content" } as React.CSSProperties}
      />
      {text.length > maxChars * 0.8 && (
        <span className={`self-center font-mono text-[11px] tabular-nums ${over ? "text-danger" : "text-subtle"}`}>
          {text.length}/{maxChars}
        </span>
      )}
      <button
        type="submit"
        disabled={!trimmed || over}
        aria-label="Translate"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fg text-bg transition-opacity disabled:opacity-25"
      >
        <ArrowUpIcon className="h-4 w-4" />
      </button>
    </form>
  );
});

Composer.displayName = "Composer";

export default Composer;
