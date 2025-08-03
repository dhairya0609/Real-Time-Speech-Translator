import { WebSocket } from "ws";

const DEEPGRAM_API_KEY = '36c7cf6fe004b6aad06a55a5cfeb8e7febb8bd46'; // Replace with your actual API key
const DG_ENDPOINT = 'wss://api.deepgram.com/v1/listen?punctuate=true&language=en&utterances=true';

const ws = new WebSocket(DG_ENDPOINT, {
  headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` }
});

ws.on('open', () => {
  console.log('✅ Connected to Deepgram');
});

ws.on('error', (err) => {
  console.error('❌ Error:', err);
});

ws.on('close', (code, reason) => {
  console.log('🔌 Disconnected:', code, reason);
});

ws.on('message', (message) => {
  console.log('📩 Received:', message);
});