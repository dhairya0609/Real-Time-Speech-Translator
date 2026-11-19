import { API_URL } from "../config";
import type { Alternative, Engine, Notice, SummarySide, Tone } from "../types";

export type ServerStatus = {
  stt: boolean;
  sttMode: "standard" | "enhanced";
  autoDetect: boolean;
  ai: boolean;
  aiAvailable: boolean;
  model: string | null;
  maxTextChars: number;
  maxSessionMinutes: number;
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfterMs = 0) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(res.status, body.error || "http_error", body.message || "Something went wrong. Try again.", Number(body.retryAfterMs) || 0);
    }
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(0, "timeout", "This is taking longer than usual. Try again in a moment.");
    }
    throw new ApiError(0, "network", "Can't connect right now. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

export function fetchStatus() {
  return request<ServerStatus>("/api/status", { timeoutMs: 70000 });
}

export type TranslateResponse = {
  text: string;
  translated: string;
  romanized?: string;
  engine: Engine;
  model?: string;
  detectedLang?: string;
  notice?: Notice;
};

export function translateText(body: {
  text: string;
  sourceLang: string;
  targetLang: string;
  tone: Tone;
  context: { original: string; translated: string }[];
}) {
  return request<TranslateResponse>("/api/translate", { method: "POST", body: JSON.stringify(body), timeoutMs: 45000 });
}

export function summarize(body: {
  sourceLang: string;
  targetLang: string;
  utterances: { original: string; translated: string }[];
}) {
  return request<{ summary: { source: SummarySide; target: SummarySide }; model: string }>("/api/summarize", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: 45000,
  });
}

export function fetchAlternatives(body: {
  text: string;
  translation: string;
  sourceLang: string;
  targetLang: string;
  tone: Tone;
  context: { original: string; translated: string }[];
}) {
  return request<{ alternatives: Alternative[] }>("/api/alternatives", { method: "POST", body: JSON.stringify(body), timeoutMs: 30000 });
}
