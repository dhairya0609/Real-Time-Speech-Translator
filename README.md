# Real-Time Speech Translator

Speak in one language and read a live translation in another. The app streams microphone audio to a Node.js backend, transcribes it in real time with Deepgram, and translates each finished utterance into the target language.

**Live demo:** [trilogy-r2-1.onrender.com](https://trilogy-r2-1.onrender.com/)

## How it works

1. The React frontend captures microphone audio with `MediaRecorder` and streams 250 ms chunks over a WebSocket.
2. The Express backend relays the audio to Deepgram's streaming speech-to-text API (with automatic punctuation and utterance detection) in the chosen source language.
3. Interim transcripts are shown as you speak. Each final transcript is translated with Google Translate, falling back to LibreTranslate, and cached to avoid repeat requests.
4. Transcript and translation are sent back over the same WebSocket and displayed side by side.

## Tech stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, `ws` (WebSockets)
- **Speech-to-text:** Deepgram streaming API
- **Translation:** Google Translate, LibreTranslate (fallback)

## Project structure

```
backend/    Express + WebSocket server (Deepgram relay, translation)
frontend/   React app (language selection, audio capture, transcript display)
```

## Running locally

**Backend**

```bash
cd backend
npm install
echo "DEEPGRAM_API_KEY=<your-deepgram-key>" > .env
npm start   # listens on PORT, default 5000
```

**Frontend**

The frontend connects to the deployed backend by default. To use your local backend, change the WebSocket URL in `frontend/src/hooks/useSpeechRecognition.ts` to `ws://localhost:5000`.

```bash
cd frontend
npm install
npm start
```
