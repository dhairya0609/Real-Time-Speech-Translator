import React, { useEffect, useId, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hideClose?: boolean;
};

/** Centered dialog on larger screens, bottom sheet on phones. */
const Sheet: React.FC<Props> = ({ open, onClose, title, children, footer, hideClose }) => {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    (panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="absolute inset-0 animate-fade-in bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex outline-none max-h-[88dvh] w-full animate-sheet-up flex-col rounded-t-2xl border border-line bg-surface shadow-pop sm:max-w-md sm:animate-pop sm:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" />
        <header className="flex items-center gap-2 px-6 pb-1 pt-4 sm:pt-6">
          <h2 id={id} className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          {!hideClose && (
            <button type="button" onClick={onClose} className="icon-btn -mr-2 ml-auto" aria-label="Close">
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </header>
        <div className="scroll-area overflow-y-auto px-6 pb-6 pt-2 text-sm leading-relaxed text-muted">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
};

export default Sheet;
