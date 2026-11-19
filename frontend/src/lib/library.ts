import type { Saved, StoredConversation, Utterance } from "../types";
import { load, save } from "./storage";

const SAVED_KEY = "lt.saved";
const HISTORY_KEY = "lt.history";
const KEEP_KEY = "lt.keepHistory";
const MAX_SAVED = 200;
const MAX_CONVERSATIONS = 30;
const MAX_LINES = 300;

export function loadSaved(): Saved[] {
  const v = load<Saved[]>(SAVED_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function storeSaved(items: Saved[]) {
  save(SAVED_KEY, items.slice(0, MAX_SAVED));
}

export function keepHistory(): boolean {
  return load<boolean>(KEEP_KEY, true) !== false;
}

export function setKeepHistory(on: boolean) {
  save(KEEP_KEY, on);
  if (!on) save(HISTORY_KEY, []);
}

export function loadHistory(): StoredConversation[] {
  const v = load<StoredConversation[]>(HISTORY_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function storeConversation(conv: StoredConversation) {
  if (!keepHistory()) return;
  const lines = conv.utterances
    .filter((u) => u.status === "done")
    .slice(-MAX_LINES)
    .map(({ id, via, speaker, at, original, sourceLang, targetLang, detectedLang, translated, romanized, engine }) => ({
      id, via, speaker, at, original, sourceLang, targetLang, detectedLang, translated, romanized, engine, status: "done" as const,
    }));
  const rest = loadHistory().filter((c) => c.id !== conv.id);
  if (!lines.length) {
    save(HISTORY_KEY, rest);
    return;
  }
  save(HISTORY_KEY, [{ ...conv, utterances: lines as Utterance[], updatedAt: Date.now() }, ...rest].slice(0, MAX_CONVERSATIONS));
}

export function deleteConversation(id: string) {
  save(HISTORY_KEY, loadHistory().filter((c) => c.id !== id));
}

export function clearHistory() {
  save(HISTORY_KEY, []);
}
