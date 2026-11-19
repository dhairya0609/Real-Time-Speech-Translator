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
  speaker: "a" | "b";
  at: number;
  original: string;
  sourceLang: string;
  targetLang: string;
  detectedLang?: string;
  status: "translating" | "done" | "failed";
  translated?: string;
  romanized?: string;
  waiting?: boolean;
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

export type Saved = {
  id: string;
  at: number;
  original: string;
  translated: string;
  romanized?: string;
  sourceLang: string;
  targetLang: string;
};

export type StoredConversation = {
  id: string;
  startedAt: number;
  updatedAt: number;
  sourceLang: string;
  targetLang: string;
  utterances: Utterance[];
};

export type Alternative = { label: string; text: string; romanized?: string };

export type MicState = "idle" | "connecting" | "listening" | "processing" | "error";
