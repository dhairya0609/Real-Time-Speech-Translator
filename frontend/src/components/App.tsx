import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import Header, { ServerState } from "./Header";
import LanguageBar, { ToneToggle } from "./LanguageBar";
import Timeline from "./Timeline";
import Waveform from "./Waveform";
import MicButton from "./MicButton";
import Composer from "./Composer";
import SummaryPanel from "./SummaryPanel";
import { useTheme } from "../hooks/useTheme";
import { LiveTranslation, useLiveTranslation } from "../hooks/useLiveTranslation";
import { ApiError, fetchStatus, summarize, translateText } from "../lib/api";
import { AUTO, languageName } from "../lib/languages";
import { download, exportName, toMarkdown, toPlainText } from "../lib/export";
import { load, save } from "../lib/storage";
import type { Notice, Summary, Tone, Utterance } from "../types";

type Settings = { sourceLang: string; targetLang: string; tone: Tone };
type Banner = { text: string; action?: { label: string; run: () => void } } | null;

const DEFAULT_SETTINGS: Settings = { sourceLang: "en", targetLang: "hi", tone: "casual" };

const BANNER_FOR: Partial<Record<Notice, string>> = {
  ai_rate_limited: "You've hit the AI translation limit for now, so lines use classic translation for a bit.",
  ai_daily_cap: "Today's free AI quota is used up. Translation continues with the classic engine until tomorrow.",
  ai_busy: "The AI model is busy right now, so classic translation is filling in.",
};

let localId = 0;

function spokenLanguage(u: Utterance) {
  return u.sourceLang === AUTO ? u.detectedLang : u.sourceLang;
}

const App: React.FC = () => {
  const { theme, toggle: toggleTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load("lt.settings", {}) }));
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [server, setServer] = useState<ServerState>({ phase: "waking", status: null });
  const [banner, setBanner] = useState<Banner>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryAt, setSummaryAt] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const seenNotices = useRef(new Set<string>());
  const utterancesRef = useRef(utterances);
  utterancesRef.current = utterances;

  const { sourceLang, targetLang, tone } = settings;
  const status = server.status;
  const maxChars = status?.maxTextChars ?? 1000;

  useEffect(() => save("lt.settings", settings), [settings]);

  const loadStatus = useCallback(() => {
    setServer((s) => ({ ...s, phase: "waking" }));
    fetchStatus()
      .then((st) => setServer({ phase: "ready", status: st }))
      .catch(() => setServer({ phase: "offline", status: null }));
  }, []);

  useEffect(loadStatus, [loadStatus]);

  const patch = useCallback((id: string, changes: Partial<Utterance>) => {
    setUtterances((list) => list.map((u) => (u.id === id ? { ...u, ...changes } : u)));
  }, []);

  const noteNotice = useCallback((notice?: Notice) => {
    if (!notice || seenNotices.current.has(notice)) return;
    const text = BANNER_FOR[notice];
    if (!text) return;
    seenNotices.current.add(notice);
    setBanner({ text });
  }, []);

  const live = useLiveTranslation(settings, {
    onUtterance: ({ id, text, detectedLang }) => {
      setUtterances((list) => [
        ...list,
        { id, via: "voice", at: Date.now(), original: text, sourceLang, targetLang, detectedLang, status: "translating" },
      ]);
    },
    onTranslation: (t: LiveTranslation) => {
      const ok = Boolean(t.translated) && t.notice !== "translation_failed";
      patch(t.id, {
        status: ok ? "done" : "failed",
        translated: t.translated,
        engine: t.engine,
        model: t.model,
        notice: t.notice,
        targetLang: t.targetLang || targetLang,
        ...(t.detectedLang ? { detectedLang: t.detectedLang } : {}),
        error: ok ? undefined : "Couldn't translate this one.",
      });
      noteNotice(t.notice);
    },
    onNotice: (text) => setBanner({ text }),
  });

  const contextBefore = (id: string) => {
    const list = utterancesRef.current;
    const end = list.findIndex((u) => u.id === id);
    return list
      .slice(0, end < 0 ? list.length : end)
      .filter((u) => u.status === "done" && u.translated)
      .slice(-3)
      .map((u) => ({ original: u.original, translated: u.translated! }));
  };

  const runTranslation = async (u: Utterance) => {
    try {
      const r = await translateText({
        text: u.original,
        sourceLang: spokenLanguage(u) || AUTO,
        targetLang: u.targetLang,
        tone,
        context: contextBefore(u.id),
      });
      const ok = r.notice !== "translation_failed";
      patch(u.id, {
        status: ok ? "done" : "failed",
        translated: r.translated,
        engine: r.engine,
        model: r.model,
        notice: r.notice,
        detectedLang: u.detectedLang || r.detectedLang,
        error: ok ? undefined : "Every translator failed for this one. Try again in a moment.",
      });
      noteNotice(r.notice);
      if (server.phase !== "ready") loadStatus();
    } catch (err) {
      patch(u.id, { status: "failed", error: (err as ApiError).message });
    }
  };

  const translateTyped = (text: string) => {
    const u: Utterance = {
      id: `t${++localId}`,
      via: "text",
      at: Date.now(),
      original: text,
      sourceLang,
      targetLang,
      status: "translating",
    };
    setUtterances((list) => [...list, u]);
    runTranslation(u);
  };

  const retry = (u: Utterance) => {
    const next: Utterance = { ...u, status: "translating", error: undefined, targetLang };
    patch(u.id, next);
    runTranslation(next);
  };

  const detected = useMemo(() => {
    if (sourceLang !== AUTO) return undefined;
    for (let i = utterances.length - 1; i >= 0; i--) if (utterances[i].detectedLang) return utterances[i].detectedLang;
    return undefined;
  }, [utterances, sourceLang]);

  const swap = () => {
    const from = sourceLang === AUTO ? detected : sourceLang;
    if (!from) return;
    setSettings((s) => ({ ...s, sourceLang: s.targetLang, targetLang: from }));
  };

  const doneCount = utterances.filter((u) => u.status === "done").length;

  const runSummary = async () => {
    setSummaryOpen(true);
    setSummaryError(null);
    if (status && !status.ai) {
      setSummaryError("Summaries need the AI model, which isn't set up on this server yet. Export still works.");
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

  const clear = () => {
    const snapshot = { utterances, summary, summaryAt };
    setUtterances([]);
    setSummary(null);
    setSummaryAt(0);
    setBanner({
      text: "Conversation cleared.",
      action: {
        label: "Undo",
        run: () => {
          setUtterances(snapshot.utterances);
          setSummary(snapshot.summary);
          setSummaryAt(snapshot.summaryAt);
          setBanner(null);
        },
      },
    });
  };

  const micDisabled = server.phase === "ready" && status?.stt === false;
  const { state: micState, start, stop, dismissError } = live;

  const onMic = useCallback(() => {
    if (micState === "listening" || micState === "connecting") return stop();
    if (micState === "error") dismissError();
    return start();
  }, [micState, start, stop, dismissError]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || summaryOpen || micDisabled) return;
      if ((e.target as HTMLElement).closest("input, textarea, button, [role='listbox'], [role='menu']")) return;
      e.preventDefault();
      onMic();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMic, summaryOpen, micDisabled]);

  const pair = `${sourceLang === AUTO ? (detected ? languageName(detected) : "Auto") : languageName(sourceLang)} → ${languageName(targetLang)}`;

  let statusLine: React.ReactNode;
  switch (micState) {
    case "connecting":
      statusLine = live.slowStart ? "Waking up the server. Free hosting can take up to a minute…" : "Connecting…";
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
        "Voice isn't set up on this server yet. Type below to translate."
      ) : (
        <>
          Tap the mic to speak
          <span className="hidden sm:inline">
            {" "}
            or press <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">Space</kbd>
          </span>
        </>
      );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <Header
        server={server}
        theme={theme}
        hasContent={doneCount > 0}
        onToggleTheme={toggleTheme}
        onSummarize={openSummary}
        onExport={exportAs}
        onClear={clear}
        onRetryServer={loadStatus}
        mobileExtra={<ToneToggle compact value={tone} onChange={(t) => setSettings((s) => ({ ...s, tone: t }))} />}
      />

      <div className="border-b border-line px-4 py-3 sm:px-6">
        <LanguageBar
          sourceLang={sourceLang}
          targetLang={targetLang}
          detected={detected}
          autoHint={status?.autoDetect ? "Detects spoken and typed language" : "Detects typed language"}
          tone={tone}
          onSource={(code) => setSettings((s) => ({ ...s, sourceLang: code }))}
          onTarget={(code) => setSettings((s) => ({ ...s, targetLang: code }))}
          onSwap={swap}
          onTone={(t) => setSettings((s) => ({ ...s, tone: t }))}
        />
      </div>

      <Timeline
        utterances={utterances}
        interim={live.interim}
        micState={micState}
        sourceLang={sourceLang}
        aiOn={Boolean(status?.ai)}
        onRetry={retry}
        onSample={translateTyped}
      />

      <footer className="border-t border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
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

          <div className="relative flex h-16 items-center justify-center">
            <Waveform
              analyser={live.analyser}
              active={micState === "listening" || micState === "connecting"}
              gap={96}
              className="absolute inset-0 h-full w-full"
            />
            <MicButton
              state={micState}
              analyser={live.analyser}
              onClick={onMic}
              disabled={micDisabled}
              disabledReason="Voice isn't set up on this server yet"
            />
          </div>

          <p className="mt-2 min-h-[1.25rem] text-center text-xs leading-5 text-muted" aria-live="polite">
            {statusLine}
          </p>

          <div className="mt-3">
            <Composer ref={composerRef} onSubmit={translateTyped} maxChars={maxChars} />
          </div>
        </div>
      </footer>

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
    </div>
  );
};

export default App;
