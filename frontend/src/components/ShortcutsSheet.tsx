import React from "react";
import Sheet from "./Sheet";

const SHORTCUTS: [string[], string][] = [
  [["Space"], "Start or stop listening"],
  [["/"], "Type a message"],
  [["Enter"], "Translate typed text"],
  [["Shift", "Enter"], "New line"],
  [["S"], "Swap languages"],
  [["?"], "Show keyboard shortcuts"],
  [["Esc"], "Close a panel"],
];

const Key: React.FC<{ k: string }> = ({ k }) => (
  <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-line bg-raised px-1.5 font-mono text-[11px] font-medium text-fg">
    {k}
  </kbd>
);

const ShortcutsSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Sheet open={open} onClose={onClose} title="Keyboard shortcuts">
    <ul className="divide-y divide-line">
      {SHORTCUTS.map(([keys, label]) => (
        <li key={label} className="flex items-center justify-between gap-4 py-2.5">
          <span className="text-fg">{label}</span>
          <span className="flex items-center gap-1">
            {keys.map((k) => (
              <Key key={k} k={k} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  </Sheet>
);

export default ShortcutsSheet;
