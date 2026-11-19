import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
};

/** Menu anchored to a button, rendered in a portal so scroll containers can't clip it. */
const Popover: React.FC<Props> = ({ anchor, open, onClose, children, width = 224 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const h = ref.current?.offsetHeight || 200;
    const below = r.bottom + 6 + h < window.innerHeight - 8;
    setPos({
      top: below ? r.bottom + 6 : Math.max(8, r.top - h - 6),
      left: Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8),
    });
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onScroll = () => onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onClose, anchor]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      className="fixed z-[60] animate-pop rounded-xl border border-line bg-surface p-1.5 shadow-pop"
    >
      {children}
    </div>,
    document.body
  );
};

export default Popover;
