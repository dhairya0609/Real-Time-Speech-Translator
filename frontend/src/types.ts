export type Tone = "casual" | "formal";

export type Engine = "gemini" | "google" | "mymemory" | "libre" | "same" | "none";

export type Notice =
  | "ai_unconfigured"
  | "ai_rate_limited"
  | "ai_daily_cap"
  | "ai_busy"
  | "ai_timeout"
  | "ai_error"
  | "translation_failed";

export type Utterance = {
  id: string;
  via: "voice" | "text";
  at: number;
  original: string;
  sourceLang: string;
  targetLang: string;
  detectedLang?: string;
  status: "translating" | "done" | "failed";
  translated?: string;
  engine?: Engine;
  model?: string;
  notice?: Notice;
  error?: string;
};

export type SummarySide = { summary: string; actionItems: string[] };

export type Summary = {
  source: SummarySide;
  target: SummarySide;
  sourceLang: string;
  targetLang: string;
  model?: string;
  createdAt: number;
};

export type MicState = "idle" | "connecting" | "listening" | "processing" | "error";
