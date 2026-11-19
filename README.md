# Real-Time Speech Translator

Speak or type in one language and read a live, context-aware translation in another. Audio streams to a Node.js backend, Deepgram transcribes it in real time, and each finished utterance is translated by Google Gemini using the previous few turns as context, so pronouns, tone and idioms carry over. Classic machine translation takes over automatically whenever the AI is unavailable.

**Live demo:** [trilogy-r2-1.onrender.com](https://trilogy-r2-1.onrender.com/)

## Features

- **Live voice translation.** Mic audio streams over a WebSocket to Deepgram; each utterance becomes a card with the original and its translation. A live level meter (Web Audio `AnalyserNode`) shows the mic is picking you up.
- **Context-aware AI translation.** Gemini sees the last few turns, so "she", "it" and the register of the conversation are translated consistently. A casual / formal toggle sets the tone.
- **Type to translate.** No mic, or permission denied? Type instead; it goes through the same AI path. Sample phrases let first-time visitors try it in one click.
- **Summarize.** One click produces a short summary and action items in both languages.
- **Export.** Download the transcript (plus the summary, if any) as Markdown or plain text.
- **Conversation mode.** Swapping languages hands the conversation to the other person; their lines align to the other side, like a chat.
- **Read aloud and copy** on every card, light and dark themes, and keyboard shortcuts (Space to talk, `/` to type, `S` to swap, `?` for the list).
- **Friendly first run.** Sample phrases, a short explanation before the browser's microphone prompt, a progress indicator while the free-tier backend wakes up, and an About sheet with the privacy note (audio is never stored; the conversation stays in the browser tab).
- **Auto-detect.** Typed text is always auto-detected. Spoken auto-detect uses Deepgram nova-3 multilingual and is opt-in (see `DEEPGRAM_MODE`).
- **Shows its work, quietly.** A small icon on each card marks AI versus standard translation; hovering it names the provider.

## How translation and fallback work

1. A finished utterance (spoken or typed) goes to Gemini (`@google/genai`, `GEMINI_MODEL`) with up to `TRANSLATION_CONTEXT_TURNS` earlier turns, the tone, and a JSON response schema. The call has a hard deadline (`GEMINI_TIMEOUT_MS`).
2. If Gemini is not configured, rate-limited (per IP or the global daily cap), slow, returns odd output, or errors, the same text goes to the classic path: Google's public translate endpoints, then MyMemory, then LibreTranslate (only if `LIBRETRANSLATE_URL` is set). Results are cached in memory.
3. After a 429, an invalid key or an unknown model, Gemini is skipped for a cool-down period instead of failing on every line. After a 400 it retries once without the schema/thinking options and keeps that simpler mode.
4. Translation never blocks the transcript: utterances reach the browser immediately and their translations arrive when ready.

Summaries need Gemini; without it the panel says so and export still works.

## Configuration

### Backend (`backend/.env` locally, environment variables on Render)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEEPGRAM_API_KEY` | none | Live speech. Without it the mic is disabled and the app is type-only. |
| `GEMINI_API_KEY` | none | Gemini translation and summaries ([get a free key](https://aistudio.google.com/apikey)). Without it, classic translation is used. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Any Gemini model id. |
| `GEMINI_THINKING_LEVEL` | `LOW` | `LOW`, `MEDIUM`, `HIGH`, or `OFF` to send no thinking config. |
| `GEMINI_TIMEOUT_MS` | `5000` | Deadline per translation before falling back. |
| `GEMINI_SUMMARY_TIMEOUT_MS` | `20000` | Deadline per summary. |
| `TRANSLATION_CONTEXT_TURNS` | `3` | Earlier turns sent as context. |
| `DEEPGRAM_MODE` | `standard` | `standard` sends the original Deepgram request. `enhanced` opts into nova-3/nova-2, interim text, sentence grouping and spoken auto-detect (`language=multi`). |
| `AI_TRANSLATE_PER_MIN` / `AI_TRANSLATE_PER_DAY` | `20` / `300` | Gemini translations per client IP. |
| `AI_SUMMARY_PER_HOUR` | `6` | Summaries per client IP. |
| `AI_GLOBAL_PER_MIN` / `AI_DAILY_CAP` | `30` / `1000` | Gemini calls across all users (the daily cap resets at 00:00 UTC). |
| `TRANSLATE_PER_MIN` | `40` | Any `/api/translate` call per client IP. |
| `MAX_SESSION_MINUTES` / `MAX_SOCKETS_PER_IP` | `10` / `3` | Live session length and concurrent sessions per IP. |
| `ALLOWED_ORIGINS` | any | Optional comma-separated CORS / WebSocket origin allow-list. |
| `LIBRETRANSLATE_URL` / `LIBRETRANSLATE_API_KEY` | none | Optional LibreTranslate instance for the last fallback. |

Keys are only read on the server; they are never sent to the browser or written to logs, and logs record lengths and timings, not transcript text.

### Frontend (build-time)

| Variable | Default | Purpose |
| --- | --- | --- |
| `REACT_APP_WS_URL` | `wss://trilogy-r2.onrender.com` | Backend WebSocket. |
| `REACT_APP_API_URL` | derived from `REACT_APP_WS_URL` | Backend HTTP base for `/api/*`. |

## Backend endpoints

- `GET /health`: whether the Gemini and Deepgram keys are configured, the model id, Deepgram mode, and the last Gemini success/failure. Calls neither service.
- `GET /api/status`: what the UI needs (voice available, AI on, limits).
- `POST /api/translate`: `{ text, sourceLang, targetLang, tone, context }`.
- `POST /api/summarize`: `{ utterances, sourceLang, targetLang }`.
- WebSocket: `start` / `settings` / `stop` messages plus binary audio; replies with `ready`, `transcript` (interim), `utterance`, `translation`, `notice`, `error` and `stopped`.

## Running locally

```bash
cd backend
npm install
cp .env.example .env    # add keys if you have them; everything works without
npm start               # http://localhost:5000
```

```bash
cd frontend
npm install
REACT_APP_WS_URL=ws://localhost:5000 npm start
```

### Checks

```bash
cd backend
npm run test:fallback   # offline: stubs Gemini (errors, 401/404/429, hangs, bad output) and fakes Deepgram
npm run smoke:ai        # live: needs GEMINI_API_KEY; checks context, idioms, tone, auto-detect and summary
```

## Tech stack

- **Frontend:** React, TypeScript, Tailwind CSS (Create React App), Geist font
- **Backend:** Node.js 22+, Express, `ws`
- **Speech-to-text:** Deepgram streaming API
- **Translation:** Google Gemini (`@google/genai`), with Google Translate, MyMemory and LibreTranslate as fallbacks
