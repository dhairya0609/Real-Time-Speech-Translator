import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "../config";
import type { Engine, MicState, Notice, Tone } from "../types";

export type MicError = { code: string; message: string };

export type LiveTranslation = {
  id: string;
  translated: string;
  romanized?: string;
  engine: Engine;
  model?: string;
  detectedLang?: string;
  targetLang?: string;
  notice?: Notice;
};

type Settings = { sourceLang: string; targetLang: string; tone: Tone };

type Handlers = {
  onUtterance: (u: { id: string; text: string; detectedLang?: string }) => void;
  onTranslation: (t: LiveTranslation) => void;
  onNotice?: (message: string) => void;
};

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function micErrorFrom(err: unknown): MicError {
  const name = (err as DOMException)?.name;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        code: "mic_denied",
        message: "Microphone access is blocked. Allow it from the address bar to speak.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return { code: "mic_missing", message: "No microphone found." };
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return { code: "mic_busy", message: "Your microphone is in use by another app. Close it and try again." };
    default:
      return { code: "mic_failed", message: "Couldn't start the microphone." };
  }
}

/**
 * Streams the mic to the backend over one WebSocket and reports utterances and
 * their translations. Exposes an AnalyserNode for the level meter.
 */
export function useLiveTranslation(settings: Settings, handlers: Handlers) {
  const [state, setStateRaw] = useState<MicState>("idle");
  const [error, setError] = useState<MicError | null>(null);
  const [interim, setInterim] = useState("");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [slowStart, setSlowStart] = useState(false);

  const stateRef = useRef<MicState>("idle");
  const settingsRef = useRef(settings);
  const handlersRef = useRef(handlers);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pendingRef = useRef(new Set<string>());
  const stoppedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  settingsRef.current = settings;
  handlersRef.current = handlers;

  const setState = useCallback((s: MicState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const later = (ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const releaseAudio = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      rec.ondataavailable = null;
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setAnalyser(null);
  }, []);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    }
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    releaseAudio();
    closeSocket();
    pendingRef.current.clear();
    setInterim("");
    setSlowStart(false);
    setState("idle");
  }, [closeSocket, releaseAudio, setState]);

  const fail = useCallback(
    (e: MicError) => {
      clearTimers();
      releaseAudio();
      closeSocket();
      pendingRef.current.clear();
      setInterim("");
      setSlowStart(false);
      setError(e);
      setState("error");
    },
    [closeSocket, releaseAudio, setState]
  );

  const maybeFinish = useCallback(() => {
    if (stateRef.current === "processing" && stoppedRef.current && pendingRef.current.size === 0) finish();
  }, [finish]);

  const startRecorder = useCallback(() => {
    const stream = streamRef.current;
    const ws = wsRef.current;
    if (!stream || !ws) return;
    const old = recorderRef.current;
    if (old && old.state !== "inactive") {
      old.ondataavailable = null;
      old.stop();
    }
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
    };
    rec.start(250);
    recorderRef.current = rec;
  }, []);

  const handleMessage = useCallback(
    (msg: any) => {
      switch (msg.type) {
        case "ready":
          clearTimers();
          setSlowStart(false);
          startRecorder();
          setState("listening");
          break;
        case "transcript":
          setInterim(msg.text || "");
          break;
        case "utterance":
          setInterim("");
          pendingRef.current.add(msg.id);
          handlersRef.current.onUtterance({ id: msg.id, text: msg.text, detectedLang: msg.detectedLang });
          break;
        case "translation":
          pendingRef.current.delete(msg.id);
          handlersRef.current.onTranslation(msg as LiveTranslation);
          maybeFinish();
          break;
        case "session_end":
          handlersRef.current.onNotice?.(
            `Listening paused after ${msg.minutes} minutes. Tap the mic to keep going.`
          );
          break;
        case "notice":
          if (msg.message) handlersRef.current.onNotice?.(msg.message);
          break;
        case "stopped":
          stoppedRef.current = true;
          if (stateRef.current === "listening") setState("processing");
          if (stateRef.current === "processing") {
            later(10000, finish);
            maybeFinish();
          }
          break;
        case "error":
          fail({ code: msg.code || "server_error", message: msg.message || "Something went wrong. Try again." });
          break;
        default:
          break;
      }
    },
    [fail, finish, maybeFinish, setState, startRecorder]
  );

  const start = useCallback(async () => {
    if (stateRef.current === "connecting" || stateRef.current === "listening" || stateRef.current === "processing") return;
    setError(null);
    setInterim("");
    stoppedRef.current = false;
    pendingRef.current.clear();
    setState("connecting");

    if (!window.isSecureContext) {
      return fail({ code: "insecure", message: "Voice needs a secure (https) page." });
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return fail({ code: "unsupported", message: "This browser can't stream audio. Try Chrome, Edge or Firefox." });
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      return fail(micErrorFrom(err));
    }
    if ((stateRef.current as MicState) !== "connecting") {
      stream.getTracks().forEach((t) => t.stop());
      return undefined;
    }
    streamRef.current = stream;

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      node.smoothingTimeConstant = 0.4;
      ctx.createMediaStreamSource(stream).connect(node);
      audioCtxRef.current = ctx;
      setAnalyser(node);
      ctx.resume?.().catch(() => undefined);
    } catch {
      /* the level meter is cosmetic; keep streaming without it */
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    later(4000, () => setSlowStart(true));
    later(60000, () =>
      fail({ code: "timeout", message: "Couldn't start listening. Try again in a few seconds." })
    );

    ws.onopen = () => {
      const { sourceLang, targetLang, tone } = settingsRef.current;
      ws.send(JSON.stringify({ type: "start", sourceLang, targetLang, tone }));
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      try {
        handleMessage(JSON.parse(ev.data));
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      if (stateRef.current === "processing") finish();
      else fail({ code: "connection_lost", message: "Connection lost. Tap the mic to continue." });
    };
    return undefined;
  }, [fail, finish, handleMessage, setState]);

  const stop = useCallback(() => {
    const s = stateRef.current;
    if (s === "connecting") return finish();
    if (s !== "listening") return undefined;

    setState("processing");
    setInterim("");
    const ws = wsRef.current;
    const sendStop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "stop" }));
      else finish();
    };
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = sendStop;
      rec.stop();
    } else {
      sendStop();
    }
    later(15000, finish);
    return undefined;
  }, [finish, setState]);

  const { sourceLang, targetLang, tone } = settings;

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (stateRef.current !== "listening" && stateRef.current !== "connecting") return;
    // A new source language needs a new Deepgram stream (and a fresh WebM header).
    ws.send(JSON.stringify({ type: "start", sourceLang: settingsRef.current.sourceLang, targetLang: settingsRef.current.targetLang, tone: settingsRef.current.tone }));
    setState("connecting");
  }, [sourceLang, setState]);

  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "settings", targetLang, tone }));
  }, [targetLang, tone]);

  useEffect(() => () => {
    clearTimers();
    releaseAudio();
    closeSocket();
  }, [closeSocket, releaseAudio]);

  const dismissError = useCallback(() => {
    setError(null);
    if (stateRef.current === "error") setState("idle");
  }, [setState]);

  return { state, error, interim, analyser, slowStart, start, stop, dismissError };
}
