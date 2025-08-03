import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import axios from "axios";

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const DG_ENDPOINT =
  "wss://api.deepgram.com/v1/listen?punctuate=true&language=en&utterances=true&sample_rate=48000&channels=1";
const DEEPGRAM_API_KEY =
  process.env.DEEPGRAM_API_KEY || "your_deepgram_api_key_here";

// Language code mapping for Deepgram (only actually supported languages)
const DEEPGRAM_LANGUAGE_MAP = {
  // Major languages that Deepgram definitely supports for speech recognition
  'en': 'en',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'it': 'it',
  'pt': 'pt',
  'ru': 'ru',
  'zh': 'zh',
  'ja': 'ja',
  'ko': 'ko',
  'ar': 'ar',
  'hi': 'hi',
  'bn': 'bn',
  'ur': 'ur',
  'th': 'th',
  'tr': 'tr',
  'vi': 'vi',
  'nl': 'nl',
  'pl': 'pl',
  'sv': 'sv',
  'da': 'da',
  'no': 'no',
  'fi': 'fi',
  'cs': 'cs',
  'hu': 'hu',
  'ro': 'ro',
  'bg': 'bg',
  'hr': 'hr',
  'sk': 'sk',
  'sl': 'sl',
  'et': 'et',
  'lv': 'lv',
  'lt': 'lt',
  'el': 'el',
  'mt': 'mt',
  'ga': 'ga',
  'cy': 'cy',
  'is': 'is',
  'mk': 'mk',
  'sq': 'sq',
  'be': 'be',
  'uk': 'uk',
  'sr': 'sr',
  'bs': 'bs',
  'ca': 'ca',
  'gl': 'gl',
  'eu': 'eu',
  'af': 'af',
  'hy': 'hy',
  'ka': 'ka',
  'az': 'az',
  'kk': 'kk',
  'uz': 'uz',
  'tg': 'tg',
  'mn': 'mn',
  'my': 'my',
  'km': 'km',
  'lo': 'lo',
  'id': 'id',
  'ms': 'ms',
  'tl': 'tl',
  'jw': 'jw',
  'ne': 'ne',
  'si': 'si',
  'ta': 'ta',
  'te': 'te',
  'kn': 'kn',
  'ml': 'ml',
  // Regional variants (only for major languages)
  'en-US': 'en-US',
  'en-GB': 'en-GB',
  'en-AU': 'en-AU',
  'en-NZ': 'en-NZ',
  'en-IN': 'en-IN',
  'es-ES': 'es-ES',
  'es-MX': 'es-MX',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-PT',
  'fr-FR': 'fr-FR',
  'fr-CA': 'fr-CA',
  'de-DE': 'de-DE',
  'de-AT': 'de-AT',
  'it-IT': 'it-IT',
  'ru-RU': 'ru-RU',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ja-JP': 'ja-JP',
  'ko-KR': 'ko-KR',
  'ar-SA': 'ar-SA',
  'hi-IN': 'hi-IN',
  'bn-IN': 'bn-IN',
  'ur-PK': 'ur-PK',
  'th-TH': 'th-TH',
  'tr-TR': 'tr-TR',
  'vi-VN': 'vi-VN',
  'nl-NL': 'nl-NL',
  'pl-PL': 'pl-PL',
  'sv-SE': 'sv-SE',
  'da-DK': 'da-DK',
  'no-NO': 'no-NO',
  'fi-FI': 'fi-FI',
  'cs-CZ': 'cs-CZ',
  'hu-HU': 'hu-HU',
  'ro-RO': 'ro-RO',
  'bg-BG': 'bg-BG',
  'hr-HR': 'hr-HR',
  'sk-SK': 'sk-SK',
  'sl-SI': 'sl-SI',
  'et-EE': 'et-EE',
  'lv-LV': 'lv-LV',
  'lt-LT': 'lt-LT',
  'el-GR': 'el-GR',
  'mt-MT': 'mt-MT',
  'ga-IE': 'ga-IE',
  'cy-GB': 'cy-GB',
  'is-IS': 'is-IS',
  'mk-MK': 'mk-MK',
  'sq-AL': 'sq-AL',
  'be-BY': 'be-BY',
  'uk-UA': 'uk-UA',
  'sr-RS': 'sr-RS',
  'bs-BA': 'bs-BA',
  'ca-ES': 'ca-ES',
  'gl-ES': 'gl-ES',
  'eu-ES': 'eu-ES',
  'af-ZA': 'af-ZA',
  'hy-AM': 'hy-AM',
  'ka-GE': 'ka-GE',
  'az-AZ': 'az-AZ',
  'kk-KZ': 'kk-KZ',
  'uz-UZ': 'uz-UZ',
  'tg-TJ': 'tg-TJ',
  'mn-MN': 'mn-MN',
  'my-MM': 'my-MM',
  'km-KH': 'km-KH',
  'lo-LA': 'lo-LA',
  'id-ID': 'id-ID',
  'ms-MY': 'ms-MY',
  'tl-PH': 'tl-PH',
  'jw-ID': 'jw-ID',
  'ne-NP': 'ne-NP',
  'si-LK': 'si-LK',
  'ta-IN': 'ta-IN',
  'te-IN': 'te-IN',
  'kn-IN': 'kn-IN',
  'ml-IN': 'ml-IN',
};

// Function to get Deepgram language code
function getDeepgramLanguageCode(langCode) {
  // Check if the language is supported by Deepgram
  if (DEEPGRAM_LANGUAGE_MAP[langCode]) {
    return DEEPGRAM_LANGUAGE_MAP[langCode];
  }
  
  // If not supported, default to English and log a warning
  console.warn(`⚠️ Language code '${langCode}' not supported by Deepgram, defaulting to English`);
  console.warn(`⚠️ Supported languages: ${Object.keys(DEEPGRAM_LANGUAGE_MAP).join(', ')}`);
  return 'en';
}

// Translation cache to avoid re-translating the same text
const translationCache = new Map();

// Translation function using Google Translate with fallback
async function translateText(text, sourceLang, targetLang) {
  try {
    if (!text || text.trim() === "") {
      console.log("🌐 Empty text, skipping translation");
      return "";
    }
    
    // Check cache first
    const cacheKey = `${text}:${sourceLang}:${targetLang}`;
    if (translationCache.has(cacheKey)) {
      console.log(`🌐 Cache hit for: "${text}"`);
      return translationCache.get(cacheKey);
    }
    
    console.log(`🌐 Attempting to translate: "${text}" from ${sourceLang} to ${targetLang}`);
    
    // Try Google Translate first
    try {
      const response = await axios.get(`https://translate.googleapis.com/translate_a/single`, {
        params: {
          client: 'gtx',
          sl: sourceLang,
          tl: targetLang,
          dt: 't',
          q: text
        },
        timeout: 5000 // 5 second timeout
      });
      
      // Extract translated text from response
      const translatedText = response.data[0].map(item => item[0]).join('');
      console.log(`🌐 Translation successful (Google): "${text}" → "${translatedText}"`);
      
      // Cache the result
      translationCache.set(cacheKey, translatedText);
      return translatedText;
    } catch (googleError) {
      console.log("❌ Google Translate failed, trying LibreTranslate...");
      
      // Fallback to LibreTranslate
      const libreResponse = await axios.post('https://libretranslate.de/translate', {
        q: text,
        source: sourceLang,
        target: targetLang
      }, {
        timeout: 5000 // 5 second timeout
      });
      
      const translatedText = libreResponse.data.translatedText;
      console.log(`🌐 Translation successful (LibreTranslate): "${text}" → "${translatedText}"`);
      
      // Cache the result
      translationCache.set(cacheKey, translatedText);
      return translatedText;
    }
  } catch (error) {
    console.error("❌ All translation services failed:", error.message);
    console.error("❌ Translation error details:", error.response?.data || error);
    return text; // Return original text if translation fails
  }
}

wss.on("connection", (ws) => {
  console.log("✅ Client connected to transcription server");
  
  // Add connection state tracking
  ws.deepgramConnected = false;
  ws.sourceLang = 'en'; // Default source language
  ws.targetLang = 'es'; // Default target language

  ws.on("message", (message) => {
    try {
      console.log("📨 Raw message received:", typeof message, message.length);
      console.log("📨 Message is Buffer:", Buffer.isBuffer(message));
      
      // Try to parse as JSON first
      let isJsonMessage = false;
      let data = null;
      
      try {
        const messageStr = message.toString();
        console.log("📨 Message toString:", messageStr.substring(0, 100));
        
        // Check if it looks like JSON
        if (messageStr.trim().startsWith('{')) {
          data = JSON.parse(messageStr);
          isJsonMessage = true;
          console.log("📩 Parsed as JSON message:", data);
        }
      } catch (error) {
        console.log("📨 Message is not JSON, treating as binary");
      }
      
      // Handle JSON control messages
      if (isJsonMessage && data) {
        if (data.type === "start_transcription") {
          console.log("🚀 Starting transcription process...");
          
          // Store source and target language from client
          ws.sourceLang = data.sourceLang || 'en';
          ws.targetLang = data.targetLang || 'es';
          console.log("🌐 Source language set to:", ws.sourceLang);
          console.log("🌐 Target language set to:", ws.targetLang);
          
          // Get Deepgram-compatible language code
          const deepgramSourceLang = getDeepgramLanguageCode(ws.sourceLang);
          console.log("🌐 Deepgram source language:", deepgramSourceLang);
          
          // Notify frontend if language was changed
          if (deepgramSourceLang !== ws.sourceLang) {
            ws.send(JSON.stringify({
              type: "language_not_supported",
              requestedLang: ws.sourceLang,
              fallbackLang: deepgramSourceLang,
              message: `Language '${ws.sourceLang}' not supported by Deepgram, using '${deepgramSourceLang}' instead`
            }));
          }
          
          // Create Deepgram endpoint with dynamic source language
          const DG_ENDPOINT = `wss://api.deepgram.com/v1/listen?punctuate=true&language=${deepgramSourceLang}&utterances=true&sample_rate=48000&channels=1`;
          
          // 🌐 Connect to Deepgram WebSocket API
          const deepgramSocket = new WebSocket(DG_ENDPOINT, {
            headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
          });

          console.log("🔌 Attempting to connect to Deepgram...");

          deepgramSocket.on("open", () => {
            console.log("✅ Deepgram WebSocket connected");
            ws.deepgramConnected = true;
            ws.send(JSON.stringify({ type: "deepgram_connected" }));
          });

          deepgramSocket.on("message", (dgMessage) => {
            try {
              const dgData = JSON.parse(dgMessage.toString());
              console.log("📝 Deepgram message:", dgMessage.toString());

              if (dgData.channel?.alternatives?.length > 0) {
                const transcript = dgData.channel.alternatives[0].transcript;

                if (transcript) {
                  console.log("🧠 Parsed transcript:", transcript);

                  // Send original transcript
                  ws.send(
                    JSON.stringify({
                      type: "transcript",
                      transcript: transcript.trim(),
                      isFinal: !!dgData.is_final,
                    })
                  );

                  // If it's a final transcript, also translate it
                  if (dgData.is_final) {
                    console.log("📤 Sent final transcript:", transcript);
                    
                    // Get source and target language from client
                    const sourceLang = ws.sourceLang || 'en';
                    const targetLang = ws.targetLang || 'es';
                    console.log("🌐 Will translate from", sourceLang, "to", targetLang);
                    
                    // Always translate unless source and target are the same
                    if (sourceLang !== targetLang) {
                      // Translate the transcript
                      translateText(transcript.trim(), sourceLang, targetLang).then(translatedText => {
                        console.log("🌐 Sending translation to frontend:", translatedText);
                        try {
                          ws.send(
                            JSON.stringify({
                              type: "translation",
                              original: transcript.trim(),
                              translated: translatedText,
                              sourceLang: sourceLang,
                              targetLang: targetLang,
                            })
                          );
                        } catch (sendError) {
                          console.error("❌ Failed to send translation to client:", sendError);
                        }
                      }).catch(error => {
                        console.error("❌ Translation failed:", error);
                        // Send original text as fallback
                        try {
                          ws.send(
                            JSON.stringify({
                              type: "translation",
                              original: transcript.trim(),
                              translated: transcript.trim(),
                              sourceLang: sourceLang,
                              targetLang: targetLang,
                            })
                          );
                        } catch (sendError) {
                          console.error("❌ Failed to send fallback translation:", sendError);
                        }
                      });
                    } else {
                      // If source and target are the same, just send the original as translation
                      try {
                        ws.send(
                          JSON.stringify({
                            type: "translation",
                            original: transcript.trim(),
                            translated: transcript.trim(),
                            sourceLang: sourceLang,
                            targetLang: targetLang,
                          })
                        );
                      } catch (sendError) {
                        console.error("❌ Failed to send same-language translation:", sendError);
                      }
                    }
                  }
                }
              }
            } catch (dgError) {
              console.error("❌ Error processing Deepgram message:", dgError);
            }
          });

          deepgramSocket.on("error", (err) => {
            console.error("❌ Deepgram WebSocket Error:", err);
            console.error("❌ Error details:", err.message);
            console.error("❌ Error code:", err.code);
            ws.deepgramConnected = false;
            
            // Don't crash the server, just send error to client
            try {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Deepgram connection failed: " + err.message,
                })
              );
            } catch (sendError) {
              console.error("❌ Failed to send error to client:", sendError);
            }
          });

          const keepAliveInterval = setInterval(() => {
            if (deepgramSocket.readyState === WebSocket.OPEN) {
              deepgramSocket.send(JSON.stringify({ type: "KeepAlive" }));
              console.log("🔄 KeepAlive sent to Deepgram");
            }
          }, 10000);

          deepgramSocket.on("close", () => {
            clearInterval(keepAliveInterval);
            ws.deepgramConnected = false;
            console.log("🔌 Deepgram Socket Closed and keep-alive stopped");
          });

          // Save reference to Deepgram socket on client socket
          ws.deepgramSocket = deepgramSocket;
        }

        if (data.type === "test") {
          console.log("🧪 Test message received:", data.data);
          ws.send(JSON.stringify({ type: "test_response", data: "test_acknowledged" }));
        }

        if (data.type === "update_target_language") {
          console.log("🌐 Updating target language to:", data.targetLang);
          ws.targetLang = data.targetLang;
          ws.send(JSON.stringify({ 
            type: "target_language_updated", 
            targetLang: data.targetLang 
          }));
        }

        if (data.type === "update_source_language") {
          console.log("🌐 Updating source language to:", data.sourceLang);
          ws.sourceLang = data.sourceLang;
          ws.send(JSON.stringify({ 
            type: "source_language_updated", 
            sourceLang: data.sourceLang 
          }));
        }

        if (data.type === "stop_transcription") {
          console.log("🛑 Stopping transcription...");
          if (ws.deepgramSocket) {
            ws.deepgramSocket.close();
            ws.deepgramSocket = null;
            ws.deepgramConnected = false;
          }
        }
        
        return; // Exit early for JSON messages
      }

      // Handle binary audio chunks
      if (Buffer.isBuffer(message)) {
        console.log("📥 Received binary audio chunk:", message.length);

        if (
          ws.deepgramSocket &&
          ws.deepgramSocket.readyState === WebSocket.OPEN &&
          ws.deepgramConnected
        ) {
          console.log("🔊 Forwarding audio to Deepgram");
          ws.deepgramSocket.send(message);
        } else {
          console.warn("⚠️ Deepgram socket not ready. Connection state:", ws.deepgramConnected);
        }
      }
    } catch (error) {
      console.error("❌ Error processing WebSocket message:", error);
      try {
        ws.send(JSON.stringify({
          type: "error",
          message: "Server error processing message: " + error.message,
        }));
      } catch (sendError) {
        console.error("❌ Failed to send error to client:", sendError);
      }
    }
  });

  ws.on("close", () => {
    console.log("🔌 Client disconnected");
    if (ws.deepgramSocket) {
      ws.deepgramSocket.close();
      ws.deepgramSocket = null;
      ws.deepgramConnected = false;
    }
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });
});

// Global error handler for WebSocket server
wss.on("error", (error) => {
  console.error("❌ WebSocket server error:", error);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`✅ Backend running on port ${PORT}`)
);

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('❌ Stack trace:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});