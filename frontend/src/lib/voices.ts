import { useEffect, useState } from "react";
import { bcp47 } from "./languages";

const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function refresh() {
  if (!synth) return;
  voices = synth.getVoices();
  listeners.forEach((l) => l());
}

if (synth) {
  refresh();
  synth.addEventListener?.("voiceschanged", refresh);
}

function onVoicesChanged(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Prefer the natural-sounding voices browsers ship (Edge "Natural", Chrome
// "Google", Apple "Premium"/"Enhanced") over the robotic defaults.
function score(v: SpeechSynthesisVoice, lang: string) {
  let s = 0;
  const name = v.name.toLowerCase();
  if (v.lang.toLowerCase() === lang.toLowerCase()) s += 3;
  if (/natural|neural/.test(name)) s += 6;
  if (/premium|enhanced|siri/.test(name)) s += 5;
  if (/google/.test(name)) s += 3;
  if (!v.localService) s += 1;
  if (/compact|espeak/.test(name)) s -= 4;
  return s;
}

function pickVoice(code: string): SpeechSynthesisVoice | null {
  const lang = bcp47(code);
  const base = lang.split("-")[0].toLowerCase();
  const matches = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === base);
  if (!matches.length) return null;
  return matches.sort((a, b) => score(b, lang) - score(a, lang))[0];
}

export function canSpeak(code: string) {
  return Boolean(synth) && Boolean(pickVoice(code));
}

export function speak(text: string, code: string, onEnd?: () => void) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(code);
  if (voice) u.voice = voice;
  u.lang = voice?.lang || bcp47(code);
  u.rate = 0.95;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  synth.speak(u);
}

/** Re-renders when the browser finishes loading its voice list. */
export function useVoices() {
  const [, setTick] = useState(0);
  useEffect(() => onVoicesChanged(() => setTick((t) => t + 1)), []);
}
