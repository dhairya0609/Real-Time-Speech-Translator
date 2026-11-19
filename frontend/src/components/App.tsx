import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StarIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { FaceToFaceIcon } from "./icons";
import Header, { View } from "./Header";
import LanguageBar from "./LanguageBar";
import Timeline from "./Timeline";
import Waveform from "./Waveform";
import MicButton from "./MicButton";
import Composer from "./Composer";
import SummaryPanel from "./SummaryPanel";
import AboutSheet from "./AboutSheet";
import ShortcutsSheet from "./ShortcutsSheet";
import MicPrimer from "./MicPrimer";
import StartupNotice, { TopProgress } from "./StartupNotice";
import AlternativesSheet, { AlternativesState } from "./AlternativesSheet";
import ShowLarge, { ShowItem } from "./ShowLarge";
import FaceToFace from "./FaceToFace";
import TextView, { TextResult } from "./TextView";
import { HistorySheet, SavedSheet } from "./LibrarySheets";
import { useTheme } from "../hooks/useTheme";
import { LiveTranslation, useLiveTranslation } from "../hooks/useLiveTranslation";
import { ApiError, fetchAlternatives, fetchStatus, ServerStatus, summarize, translateText } from "../lib/api";
import { AUTO, languageName } from "../lib/languages";
import { download, exportName, toMarkdown, toPlainText } from "../lib/export";
import { load, save } from "../lib/storage";
import { clearHistory, deleteConversation, keepHistory, loadHistory, loadSaved, setKeepHistory, storeConversation, storeSaved } from "../lib/library";
import { useVoices } from "../lib/voices";
import type { Alternative, Notice, Saved, StoredConversation, Summary, Tone, Utterance } from "../types";

type Settings = { sourceLang: string; targetLang: string; tone: Tone; showRoman: boolean };
type Banner = { text: string; action?: { label: string; run: () => void } } | null;
type ServerState = { phase: "waking" | "ready" | "offline"; status: ServerStatus | null };
type Side = "a" | "b";

const DEFAULT_SETTINGS: Settings = { sourceLang: "en", targetLang: "hi", tone: "casual", showRoman: true };
const UNAVAILABLE = "Translation is temporarily unavailable.";
const MAX_AUTO_RETRIES = 3;

const BANNER_FOR: Partial<Record<Notice, string>> = {
  ai_rate_limited: "It's busy right now, so translations may miss some context for a few minutes.",
  ai_busy: "It's busy right now, so translations may miss some context for a few minutes.",
  ai_daily_cap: "High demand today. Translations continue, but may miss some context from earlier lines.",
};

let localId = 0;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function spokenLanguage(u: Utterance) {
  return u.sourceLang === AUTO ? u.detectedLang : u.sourceLang;
}

async function micPermission(): Promise<PermissionState> {
  try {
    const r = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return r.state;
  } catch {
    return "prompt";
  }
}

function isTyping(target: EventTarget | null) {
  return Boolean((target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable='true']"));
}

const savedKey = (original: string, translated: string) => `${original}\u0000${translated}`;

const App: React.FC = () => {
  useVoices();
  const { theme, toggle: toggleTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load("lt.settings", {}) }));
  const [view, setView] = useState<View>(() => (load<string>("lt.view", "conversation") === "text" ? "text" : "conversation"));
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [conv, setConv] = useState(() => ({ id: newId(), startedAt: Date.now() }));
  const [speaker, setSpeaker] = useState<Side>("a");
  const [server, setServer] = useState<ServerState>({ phase: "waking", status: null });
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [banner, setBanner] = useState<Banner>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryAt, setSummaryAt] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [primer, setPrimer] = useState<"prompt" | "denied" | null>(null);
  const [saved, setSaved] = useState<Saved[]>(loadSaved);
  const [savedOpen, setSavedOpen] = useState(false);
  const [history, setHistory] = useState<StoredConversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keep, setKeep] = useState(keepHistory);
  const [alts, setAlts] = useState<AlternativesState>(null);
  const [show, setShow] = useState<ShowItem>(null);
  const [faceToFace, setFaceToFace] = useState(false);
  const [textSwap, setTextSwap] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const altsRequest = useRef<{ body: Parameters<typeof fetchAlternatives>[0]; apply: (t: string, r?: string) => void } | null>(null);
  const seenNotices = useRef(new Set<string>());
  const retries = useRef(new Map<string, number>());
  const utterancesRef = useRef(utterances);
  utterancesRef.current = utterances;
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;

  const { sourceLang, targetLang, tone, showRoman } = settings;
  const status = server.status;
  const aiOn = Boolean(status?.ai);
  const maxChars = status?.maxTextChars ?? 1000;
  const setTone = useCallback((t: Tone) => setSettings((s) => ({ ...s, tone: t })), []);

  useEffect(() => save("lt.settings", settings), [settings]);
  useEffect(() => save("lt.view", view), [view]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      storeConversation({ id: conv.id, startedAt: conv.startedAt, updatedAt: Date.now(), sourceLang, targetLang, utterances });
    }, 400);
    return () => window.clearTimeout(t);
  }, [utterances, conv, sourceLang, targetLang]);

  const loadStatus = useCallback(() => {
    setServer((s) => ({ ...s, phase: "waking" }));
    fetchStatus()
      .then((st) => setServer({ phase: "ready", status: st }))
      .catch(() => setServer({ phase: navigator.onLine === false ? "waking" : "offline", status: null }));
  }, []);

  useEffect(loadStatus, [loadStatus]);

  const patch = useCallback((id: string, changes: Partial<Utterance>) => {
    setUtterances((list) => list.map((u) => (u.id === id ? { ...u, ...changes } : u)));
  }, []);

  const noteNotice = useCallback((notice?: Notice) => {
    const text = notice && BANNER_FOR[notice];
    if (!text || seenNotices.current.has(text)) return;
    seenNotices.current.add(text);
    setBanner({ text });
  }, []);

  const live = useLiveTranslation(
    { sourceLang, targetLang, tone },
    {
      onUtterance: ({ id, text, detectedLang }) => {
        setUtterances((list) => [
          ...list,
          { id, via: "voice", speaker: speakerRef.current, at: Date.now(), original: text, sourceLang, targetLang, detectedLang, status: "translating" },
        ]);
      },
      onTranslation: (t: LiveTranslation) => {
        const ok = Boolean(t.translated) && t.notice !== "translation_failed";
        patch(t.id, {
          status: ok ? "done" : "failed",
          translated: t.translated,
          romanized: t.romanized,
          engine: t.engine,
          model: t.model,
          notice: t.notice,
          targetLang: t.targetLang || targetLang,
          ...(t.detectedLang ? { detectedLang: t.detectedLang } : {}),
          error: ok ? undefined : UNAVAILABLE,
        });
        noteNotice(t.notice);
      },
      onNotice: (text) => setBanner({ text }),
    }
  );

  const contextBefore = (id?: string) => {
    const list = utterancesRef.current;
    const end = id ? list.findIndex((u) => u.id === id) : list.length;
    return list
      .slice(0, end < 0 ? list.length : end)
      .filter((u) => u.status === "done" && u.translated)
      .slice(-3)
      .map((u) => ({ original: u.original, translated: u.translated! }));
  };

  const runTranslation = async (u: Utterance) => {
    if (!navigator.onLine) {
      patch(u.id, { status: "translating", waiting: true });
      return;
    }
    try {
      const r = await translateText({
        text: u.original,
        sourceLang: spokenLanguage(u) || AUTO,
        targetLang: u.targetLang,
        tone,
        context: contextBefore(u.id),
      });
      const ok = r.notice !== "translation_failed";
      retries.current.delete(u.id);
      patch(u.id, {
        status: ok ? "done" : "failed",
        waiting: false,
        translated: r.translated,
        romanized: r.romanized,
        engine: r.engine,
        model: r.model,
        notice: r.notice,
        detectedLang: u.detectedLang || r.detectedLang,
        error: ok ? undefined : UNAVAILABLE,
      });
      noteNotice(r.notice);
      if (server.phase !== "ready") loadStatus();
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "network" && !navigator.onLine) {
        patch(u.id, { status: "translating", waiting: true });
        return;
      }
      const attempt = (retries.current.get(u.id) || 0) + 1;
      if ((e.status === 429 || e.code === "timeout") && attempt <= MAX_AUTO_RETRIES) {
        retries.current.set(u.id, attempt);
        window.setTimeout(() => runTranslation(u), Math.min(10000, e.retryAfterMs || 2500 * attempt));
        return;
      }
      retries.current.delete(u.id);
      patch(u.id, { status: "failed", waiting: false, error: e.status === 400 ? e.message : UNAVAILABLE });
    }
  };

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      utterancesRef.current.filter((u) => u.waiting).forEach((u) => runTranslation({ ...u, waiting: false }));
      if (server.phase !== "ready") loadStatus();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  });

  const translateTyped = (text: string, as?: { speaker: Side; sourceLang: string; targetLang: string }) => {
    const u: Utterance = {
      id: `t${++localId}`,
      via: "text",
      speaker: as?.speaker ?? speaker,
      at: Date.now(),
      original: text,
      sourceLang: as?.sourceLang ?? sourceLang,
      targetLang: as?.targetLang ?? targetLang,
      status: "translating",
    };
    setUtterances((list) => [...list, u]);
    runTranslation(u);
  };

  const retry = (u: Utterance) => {
    const next: Utterance = { ...u, status: "translating", error: undefined };
    retries.current.delete(u.id);
    patch(u.id, next);
    runTranslation(next);
  };

  const detected = useMemo(() => {
    if (sourceLang !== AUTO) return undefined;
    for (let i = utterances.length - 1; i >= 0; i--) if (utterances[i].detectedLang) return utterances[i].detectedLang;
    return undefined;
  }, [utterances, sourceLang]);

  const swap = useCallback(() => {
    const from = sourceLang === AUTO ? detected : sourceLang;
    if (!from) return;
    setSettings((s) => ({ ...s, sourceLang: s.targetLang, targetLang: from }));
    setSpeaker((p) => (p === "a" ? "b" : "a"));
    setTextSwap((n) => n + 1);
  }, [sourceLang, detected]);

  const doneCount = utterances.filter((u) => u.status === "done").length;

  // Saved phrases
  const savedSet = useMemo(() => new Set(saved.map((s) => savedKey(s.original, s.translated))), [saved]);
  const isSaved = useCallback((o: string, t: string) => savedSet.has(savedKey(o, t)), [savedSet]);
  const updateSaved = (next: Saved[]) => {
    setSaved(next);
    storeSaved(next);
  };
  const toggleSave = (item: Omit<Saved, "id" | "at">) => {
    const key = savedKey(item.original, item.translated);
    if (savedSet.has(key)) updateSaved(saved.filter((s) => savedKey(s.original, s.translated) !== key));
    else updateSaved([{ ...item, id: newId(), at: Date.now() }, ...saved]);
  };
  const toggleSaveUtterance = (u: Utterance) =>
    toggleSave({ original: u.original, translated: u.translated || "", romanized: u.romanized, sourceLang: spokenLanguage(u) || u.sourceLang, targetLang: u.targetLang });

  // Alternatives
  const loadAlternatives = useCallback(async () => {
    const req = altsRequest.current;
    if (!req) return;
    setAlts((s) => (s ? { ...s, loading: true, error: null } : s));
    try {
      const r = await fetchAlternatives(req.body);
      setAlts((s) => (s ? { ...s, loading: false, options: r.alternatives } : s));
    } catch (err) {
      setAlts((s) => (s ? { ...s, loading: false, error: (err as ApiError).message } : s));
    }
  }, []);

  const openAlternatives = (args: {
    original: string;
    translation: string;
    romanized?: string;
    sourceLang: string;
    targetLang: string;
    context: { original: string; translated: string }[];
    apply: (t: string, r?: string) => void;
  }) => {
    altsRequest.current = {
      body: { text: args.original, translation: args.translation, sourceLang: args.sourceLang, targetLang: args.targetLang, tone, context: args.context },
      apply: args.apply,
    };
    setAlts({ original: args.original, current: args.translation, currentRomanized: args.romanized, targetLang: args.targetLang, loading: true, error: null, options: [] });
    loadAlternatives();
  };

  const pickAlternative = (a: Alternative) => {
    altsRequest.current?.apply(a.text, a.romanized);
    setAlts(null);
  };

  // Summary
  const runSummary = async () => {
    setSummaryOpen(true);
    setSummaryError(null);
    if (status && !status.ai) {
      setSummaryError("Summaries aren't available right now. You can still export the transcript from the menu.");
      return;
    }
    setSummaryLoading(true);
    const list = utterancesRef.current.filter((u) => u.status === "done");
    const counts = new Map<string, number>();
    list.forEach((u) => {
      const l = spokenLanguage(u);
      if (l) counts.set(l, (counts.get(l) || 0) + 1);
    });
    const spoken = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || sourceLang;
    try {
      const r = await summarize({
        sourceLang: spoken,
        targetLang,
        utterances: list.map((u) => ({ original: u.original, translated: u.translated || "" })),
      });
      setSummary({ ...r.summary, sourceLang: spoken, targetLang, model: r.model, createdAt: Date.now() });
      setSummaryAt(list.length);
    } catch (err) {
      setSummaryError((err as ApiError).message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const openSummary = () => {
    if (summary && summaryAt === doneCount) setSummaryOpen(true);
    else runSummary();
  };

  const exportAs = (format: "md" | "txt") => {
    const list = utterancesRef.current.filter((u) => u.status !== "translating");
    if (format === "md") download(exportName("md"), toMarkdown(list, summary), "text/markdown");
    else download(exportName("txt"), toPlainText(list, summary), "text/plain");
  };

  const startNew = () => {
    const snapshot = { utterances, summary, summaryAt, speaker, conv };
    setUtterances([]);
    setSummary(null);
    setSummaryAt(0);
    setConv({ id: newId(), startedAt: Date.now() });
    setBanner({
      text: keep ? "New conversation. The previous one is in History." : "New conversation started.",
      action: {
        label: "Undo",
        run: () => {
          setUtterances(snapshot.utterances);
          setSummary(snapshot.summary);
          setSummaryAt(snapshot.summaryAt);
          setSpeaker(snapshot.speaker);
          setConv(snapshot.conv);
          setBanner(null);
        },
      },
    });
  };

  const openHistory = () => {
    setHistory(loadHistory());
    setHistoryOpen(true);
  };

  const openConversation = (c: StoredConversation) => {
    setUtterances(c.utterances);
    setConv({ id: c.id, startedAt: c.startedAt });
    setSettings((s) => ({ ...s, sourceLang: c.sourceLang, targetLang: c.targetLang }));
    // Keep speaker and language direction paired: whoever spoke the saved source language is the current speaker.
    const last = c.utterances[c.utterances.length - 1];
    const lastSpoke = last ? spokenLanguage(last) : undefined;
    const lastSide: Side = last?.speaker === "b" ? "b" : "a";
    setSpeaker(!last || lastSpoke === c.sourceLang || c.sourceLang === AUTO ? lastSide : lastSide === "a" ? "b" : "a");
    setSummary(null);
    setSummaryAt(0);
    setView("conversation");
    setHistoryOpen(false);
  };

  // Mic
  const micDisabled = server.phase === "ready" && status?.stt === false;
  const { state: micState, start, stop, dismissError } = live;

  const onMic = useCallback(async () => {
    if (micState === "listening" || micState === "connecting") return stop();
    if (micState === "processing") return undefined;
    if (micState === "error") dismissError();
    const permission = await micPermission();
    if (permission === "granted" || (permission === "prompt" && load("lt.micPrimed", false))) return start();
    setPrimer(permission === "denied" ? "denied" : "prompt");
    return undefined;
  }, [micState, start, stop, dismissError]);

  useEffect(() => {
    if (live.error?.code === "mic_denied") setPrimer("denied");
  }, [live.error]);

  // Face to face
  const langA = speaker === "a" ? sourceLang : targetLang;
  const langB = speaker === "a" ? targetLang : sourceLang;

  const enterFaceToFace = () => {
    if (sourceLang === AUTO) setSettings((s) => ({ ...s, sourceLang: detected || "en" }));
    setFaceToFace(true);
  };

  const talkAs = (side: Side) => {
    const active = micState === "listening" || micState === "connecting";
    if (active && speaker === side) return stop();
    if (speaker !== side) swap();
    if (!active) onMic();
    return undefined;
  };

  const anySheetOpen =
    summaryOpen || aboutOpen || shortcutsOpen || primer !== null || savedOpen || historyOpen || alts !== null || show !== null || faceToFace;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anySheetOpen || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const onControl = Boolean((e.target as HTMLElement | null)?.closest?.("button, [role='listbox'], [role='menu']"));
      if (e.code === "Space" && !e.repeat && !onControl && !micDisabled && view === "conversation") {
        e.preventDefault();
        onMic();
      } else if (e.key === "/") {
        e.preventDefault();
        (view === "text" ? textInputRef : composerRef).current?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        swap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMic, swap, anySheetOpen, micDisabled, view]);

  const pair = `${sourceLang === AUTO ? (detected ? languageName(detected) : "Auto-detect") : languageName(sourceLang)} → ${languageName(targetLang)}`;

  let statusLine: React.ReactNode;
  switch (micState) {
    case "connecting":
      statusLine = live.slowStart ? "Starting up, this can take a few seconds…" : "Connecting…";
      break;
    case "listening":
      statusLine = (
        <>
          <span className="font-medium text-accent">Listening</span> · {pair}
        </>
      );
      break;
    case "processing":
      statusLine = "Finishing the last translation…";
      break;
    case "error":
      statusLine = (
        <span className="text-danger">
          {live.error?.message}{" "}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => composerRef.current?.focus()}>
            Type instead
          </button>
        </span>
      );
      break;
    default:
      statusLine = micDisabled ? (
        "Voice input is unavailable right now. You can still type."
      ) : (
        <>
          Tap to speak
          <span className="hidden sm:inline">
            {" "}
            or press <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">Space</kbd>
          </span>
        </>
      );
  }

  const textResultToSaved = (r: TextResult) => ({
    original: r.text,
    translated: r.translated,
    romanized: r.romanized,
    sourceLang: r.sourceLang === AUTO ? r.detectedLang || AUTO : r.sourceLang,
    targetLang: r.targetLang,
  });

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <TopProgress active={server.phase === "waking" && online} />
      <Header
        view={view}
        onView={setView}
        theme={theme}
        onToggleTheme={toggleTheme}
        hasContent={doneCount > 0}
        savedCount={saved.length}
        tone={tone}
        onTone={setTone}
        showRoman={showRoman}
        onShowRoman={(on) => setSettings((s) => ({ ...s, showRoman: on }))}
        onSummarize={openSummary}
        onExport={exportAs}
        onNew={startNew}
        onSaved={() => setSavedOpen(true)}
        onHistory={openHistory}
        onFaceToFace={enterFaceToFace}
        onShortcuts={() => setShortcutsOpen(true)}
        onAbout={() => setAboutOpen(true)}
      />

      <div className="relative z-20 border-b border-line px-4 py-3 sm:px-6">
        <LanguageBar
          sourceLang={sourceLang}
          targetLang={targetLang}
          detected={detected}
          autoHint={status?.autoDetect ? "Detects spoken and typed language" : "Detects typed language"}
          tone={tone}
          onSource={(code) => setSettings((s) => ({ ...s, sourceLang: code }))}
          onTarget={(code) => setSettings((s) => ({ ...s, targetLang: code }))}
          onSwap={swap}
          onTone={setTone}
        />
      </div>

      {!online && (
        <div role="status" className="border-b border-line bg-raised/60 px-4 py-2 text-center text-sm text-muted">
          You're offline. Anything you type will translate when you're back online.
        </div>
      )}

      {view === "text" ? (
        <TextView
          sourceLang={sourceLang}
          targetLang={targetLang}
          tone={tone}
          maxChars={maxChars}
          showRoman={showRoman}
          aiOn={aiOn}
          online={online}
          swapSignal={textSwap}
          isSaved={isSaved}
          inputRef={textInputRef}
          onToggleSave={(r) => toggleSave(textResultToSaved(r))}
          onShow={(r) => setShow({ text: r.translated, romanized: r.romanized, lang: r.targetLang, original: r.text })}
          onAlternatives={(r, apply) =>
            openAlternatives({
              original: r.text,
              translation: r.translated,
              romanized: r.romanized,
              sourceLang: r.sourceLang === AUTO ? r.detectedLang || AUTO : r.sourceLang,
              targetLang: r.targetLang,
              context: [],
              apply,
            })
          }
        />
      ) : (
        <>
          <Timeline
            utterances={utterances}
            interim={live.interim}
            micState={micState}
            sourceLang={sourceLang}
            speaker={speaker}
            showRoman={showRoman}
            aiOn={aiOn}
            isSaved={isSaved}
            onRetry={retry}
            onSample={(t) => translateTyped(t)}
            onToggleSave={toggleSaveUtterance}
            onShow={(u) => setShow({ text: u.translated || "", romanized: u.romanized, lang: u.targetLang, original: u.original })}
            onAlternatives={(u) =>
              openAlternatives({
                original: u.original,
                translation: u.translated || "",
                romanized: u.romanized,
                sourceLang: spokenLanguage(u) || AUTO,
                targetLang: u.targetLang,
                context: contextBefore(u.id),
                apply: (t, r) => patch(u.id, { translated: t, romanized: r }),
              })
            }
          />

          <footer className="border-t border-line bg-bg/85 backdrop-blur">
            <div className="mx-auto w-full max-w-3xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
              {online && <StartupNotice phase={server.phase} onRetry={loadStatus} />}
              {banner && (
                <div role="status" className="mb-3 flex animate-fade-up items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-muted shadow-card">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="flex-1 leading-relaxed">{banner.text}</span>
                  {banner.action && (
                    <button type="button" onClick={banner.action.run} className="font-medium text-fg underline-offset-2 hover:underline">
                      {banner.action.label}
                    </button>
                  )}
                  <button type="button" onClick={() => setBanner(null)} className="-m-1 rounded p-1 text-subtle hover:text-fg" aria-label="Dismiss">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex flex-col">
                <div className="order-2 mt-3 sm:order-1 sm:mt-0">
                  <div className="relative flex h-16 items-center justify-between">
                    <button
                      type="button"
                      onClick={enterFaceToFace}
                      className="icon-btn z-10 h-11 w-11 rounded-full border border-line bg-surface shadow-card"
                      aria-label="Face to face"
                      title="Face to face: put the phone between you"
                    >
                      <FaceToFaceIcon className="h-5 w-5" />
                    </button>
                    <Waveform
                      analyser={live.analyser}
                      active={micState === "listening" || micState === "connecting"}
                      gap={96}
                      className="absolute inset-y-0 left-14 right-14 h-full w-[calc(100%-7rem)]"
                    />
                    <MicButton state={micState} analyser={live.analyser} onClick={onMic} disabled={micDisabled} disabledReason="Voice input is unavailable right now" />
                    <button
                      type="button"
                      onClick={() => setSavedOpen(true)}
                      className="icon-btn z-10 h-11 w-11 rounded-full border border-line bg-surface shadow-card"
                      aria-label="Saved phrases"
                      title="Saved phrases"
                    >
                      <StarIcon className={`h-5 w-5 ${saved.length ? "text-amber-500" : ""}`} />
                    </button>
                  </div>
                  <p className="mt-2 min-h-[1.25rem] text-center text-xs leading-5 text-muted" aria-live="polite">
                    {statusLine}
                  </p>
                </div>
                <div className="order-1 sm:order-2 sm:mt-3">
                  <Composer ref={composerRef} onSubmit={(t) => translateTyped(t)} maxChars={maxChars} />
                </div>
              </div>
            </div>
          </footer>
        </>
      )}

      <SummaryPanel
        open={summaryOpen}
        loading={summaryLoading}
        error={summaryError}
        summary={summary}
        stale={Boolean(summary) && summaryAt !== doneCount}
        canRetry={status?.ai !== false}
        onClose={() => setSummaryOpen(false)}
        onRegenerate={runSummary}
      />
      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <SavedSheet open={savedOpen} items={saved} showRoman={showRoman} onClose={() => setSavedOpen(false)} onRemove={(id) => updateSaved(saved.filter((s) => s.id !== id))} />
      <HistorySheet
        open={historyOpen}
        items={history}
        currentId={conv.id}
        keep={keep}
        onKeep={(on) => {
          setKeepHistory(on);
          setKeep(on);
          setHistory(on ? loadHistory() : []);
        }}
        onOpen={openConversation}
        onDelete={(id) => {
          deleteConversation(id);
          setHistory(loadHistory());
        }}
        onClearAll={() => {
          clearHistory();
          setHistory([]);
        }}
        onClose={() => setHistoryOpen(false)}
      />
      <AlternativesSheet state={alts} showRoman={showRoman} onPick={pickAlternative} onRetry={loadAlternatives} onClose={() => setAlts(null)} />
      <ShowLarge item={show} showRoman={showRoman} onClose={() => setShow(null)} />
      {faceToFace && (
        <FaceToFace
          utterances={utterances}
          interim={live.interim}
          micState={micState}
          speaker={speaker}
          langA={langA}
          langB={langB}
          showRoman={showRoman}
          micDisabled={micDisabled}
          onTalk={talkAs}
          onType={(side, text) =>
            translateTyped(text, { speaker: side, sourceLang: side === "a" ? langA : langB, targetLang: side === "a" ? langB : langA })
          }
          onExit={() => setFaceToFace(false)}
        />
      )}
      <MicPrimer
        mode={primer}
        onClose={() => setPrimer(null)}
        onType={() => {
          setPrimer(null);
          dismissError();
          requestAnimationFrame(() => composerRef.current?.focus());
        }}
        onContinue={() => {
          save("lt.micPrimed", true);
          setPrimer(null);
          dismissError();
          start();
        }}
      />
    </div>
  );
};

export default App;
