# Real-Time Speech Translator

Speak or type in one language and read a live, context-aware translation in another. Audio streams to a Node.js backend, Deepgram transcribes it in real time, and each finished utterance is translated by Google Gemini using the previous few turns as context, so pronouns, tone and idioms carry over. Classic machine translation takes over automatically whenever the AI is unavailable.

**Live demo:** [live-translator-app.onrender.com](https://live-translator-app.onrender.com/)

## Features

- **Live voice translation.** Mic audio streams over a WebSocket to Deepgram; each finished sentence becomes a card with the original and the translation, with a live level meter while you speak.
- **Context-aware AI translation.** Gemini sees the last few turns, so pronouns, names and register carry over; a casual / formal toggle sets the tone.
- **Face to face.** Put the phone between two people: the screen splits, the top half turns to face the other person, and each side has its own mic and text field.
- **Conversation and Text views.** The timeline for back-and-forth talk, and a classic two-panel translator that translates as you pause typing.
- **Other ways to say it.** Tap any translation for alternatives (more formal, more casual, shorter, closer to the original) and pick one to use.
- **Pronunciation.** Non-Latin scripts get a Latin-letter line (Hindi in everyday Hinglish spelling, pinyin, Hepburn). Gemini supplies it, Google's romanisation is the fallback, and Hindi is romanised on-device when neither is available.
- **Saved phrases and history.** Star lines to keep them; past conversations are kept in this browser only, with an off switch and delete-all.
- **Per line:** listen with the most natural voice the browser offers, copy, share, or show full screen in large type (with a flip for the person opposite).
- **Summaries and export.** A short summary with action items in both languages; download as Markdown or text.
- **Graceful when things go wrong.** Lines typed offline queue and translate on reconnect, brief throttling retries quietly, cold starts show progress, and every failure has a Retry.
- **Auto-detect.** Typed text is always auto-detected and labelled; spoken auto-detect uses Deepgram nova-3 multilingual and is opt-in (see `DEEPGRAM_MODE`).

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
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Any Gemini model id. |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.6-flash,gemini-3.8-flash` | Tried in order when the main model is overloaded, rate-limited or unavailable. |
| `GEMINI_THINKING_LEVEL` | `LOW` | `LOW`, `MEDIUM`, `HIGH`, or `OFF` to send no thinking config. |
| `GEMINI_TIMEOUT_MS` | `7000` | Deadline per translation before falling back. |
| `GEMINI_SUMMARY_TIMEOUT_MS` | `20000` | Deadline per summary. |
| `GEMINI_ALTERNATIVES_TIMEOUT_MS` | `9000` | Deadline per alternatives request. |
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
- `POST /api/alternatives`: `{ text, translation, sourceLang, targetLang, tone, context }` (Gemini only; counts toward the translation limits).
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
