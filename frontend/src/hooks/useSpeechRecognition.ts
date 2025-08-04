import { useState, useRef, useEffect, useCallback } from "react";
import { startAudioCapture, stopAudioCapture, getAudioLevel } from "../audio/audioCapture";
import { isBrowserSupported, getMicrophonePermission } from "../utils/errorHandling";

export type RecognitionResult = {
  transcript: string;
  confidence: number;
  isFinal: boolean;
};

type UseSpeechRecognitionProps = {
  language: string | "auto";
  targetLanguage: string;
  onResult: (result: RecognitionResult) => void;
  onTranslation: (translation: { original: string; translated: string; sourceLang: string; targetLang: string }) => void;
  onError: (err: string) => void;
};

export function useSpeechRecognition({
  language,
  targetLanguage,
  onResult,
  onTranslation,
  onError,
}: UseSpeechRecognitionProps) {
  const [listening, setListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [confidence, setConfidence] = useState(1);
  
  // Use ref to track accumulated transcript
  const accumulatedTranscriptRef = useRef("");

  // Audio level visualization
  useEffect(() => {
    let raf: number;
    function updateLevel() {
      setAudioLevel(getAudioLevel());
      raf = requestAnimationFrame(updateLevel);
    }
    if (listening) updateLevel();
    return () => cancelAnimationFrame(raf);
  }, [listening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line
  }, []);

  const start = useCallback(async () => {
    console.log("🎤 Starting real-time speech recognition...");

    if (!isBrowserSupported()) {
      console.error("❌ Browser not supported");
      onError("Browser not supported for speech recognition.");
      return;
    }

    const hasPermission = await getMicrophonePermission();
    if (!hasPermission) {
      console.error("❌ Microphone permission denied");
      onError("Microphone permission denied.");
      return;
    }

    setFinalTranscript("");
    setInterimTranscript("");
    setConfidence(1);
    setListening(true);

    try {
      const stream = await startAudioCapture();

      // Create WebSocket connection to backend
      const ws = new WebSocket("wss://trilogy-r2.onrender.com");
      wsRef.current = ws;

      let deepgramReady = false;

      ws.onopen = () => {
        console.log("✅ Connected to backend server");
        console.log("📤 WebSocket readyState on open:", ws.readyState);

        // Add a small delay to ensure connection is fully established
        setTimeout(() => {
          // Send a test message first
          const testMessage = JSON.stringify({ type: "test", data: "connection_test" });
          console.log("📤 Sending test message:", testMessage);
          ws.send(testMessage);
          
          // Then send the start transcription message
          setTimeout(() => {
            const startMessage = JSON.stringify({ 
              type: "start_transcription",
              sourceLang: language,
              targetLang: targetLanguage
            });
            console.log("📤 Sending start_transcription message:", startMessage);
            console.log("📤 WebSocket readyState:", ws.readyState);
            ws.send(startMessage);
            console.log("📤 Message sent successfully");
          }, 50);
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "deepgram_connected") {
            console.log("✅ Deepgram connected via backend");
            deepgramReady = true;
            
            // Only start MediaRecorder after Deepgram is connected
            if (!mediaRecorderRef.current) {
              const mediaRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm;codecs=opus",
              });
              mediaRecorderRef.current = mediaRecorder;

              mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && ws.readyState === WebSocket.OPEN && deepgramReady) {
                  console.log("🔊 Sending audio chunk of size:", event.data.size);
                  // Send raw audio chunk binary directly (no JSON wrapping)
                  event.data.arrayBuffer().then((buffer) => {
                    ws.send(buffer);
                  });
                } else {
                  console.log("⚠️ Empty audio chunk, WebSocket not open, or Deepgram not ready");
                }     
              };

              mediaRecorder.start(250); // Collect chunks every 250ms
              console.log("✅ MediaRecorder started for real-time streaming");
            }
          }

          if (data.type === "transcript") {
            console.log("🗣 Transcript received:", data.transcript, "Final:", data.isFinal);
            console.log("🗣 Current accumulated transcript:", accumulatedTranscriptRef.current);

            const transcript = data.transcript;

            if (data.isFinal) {
              // Final result - add line break for better readability
              const newAccumulatedTranscript = accumulatedTranscriptRef.current + (accumulatedTranscriptRef.current ? "\n" : "") + transcript;
              console.log("🗣 New accumulated transcript:", newAccumulatedTranscript);
              
              accumulatedTranscriptRef.current = newAccumulatedTranscript;
              setFinalTranscript(newAccumulatedTranscript);
              setInterimTranscript("");
              setConfidence(0.95);

              onResult({
                transcript: newAccumulatedTranscript,
                confidence: 0.95,
                isFinal: true,
              });
            } else {
              
              // Interim result
              setInterimTranscript(transcript);
              setConfidence(0.95);

              const currentTranscript = accumulatedTranscriptRef.current + (accumulatedTranscriptRef.current ? "\n" : "") + transcript;
              console.log("⏳ Interim transcript updated:", currentTranscript);

              onResult({
                transcript: currentTranscript,
                confidence: 0.95,
                isFinal: false,
              });
            }
          }

          if (data.type === "translation") {
            console.log("🔄 Translation received:", data.original, "->", data.translated, "Target:", data.targetLang);
            onTranslation({
              original: data.original,
              translated: data.translated,
              sourceLang: data.sourceLang,
              targetLang: data.targetLang,
            });
          }

          if (data.type === "language_not_supported") {
            console.warn("⚠️ Language not supported:", data.message);
            onError(data.message);
          }

          if (data.type === "error") {
            console.error("❌ Backend error:", data.message);
            onError(data.message);
            stop();
          }
        } catch (err) {
          console.error("❌ Failed to parse backend response:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        onError("Failed to connect to transcription server");
        setListening(false);
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket connection closed");
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
        setListening(false);
      };
    } catch (err: any) {
      console.error("❌ Failed to start audio capture:", err);
      onError(err.message || "Failed to start audio capture");
      setListening(false);
    }
  }, [onResult, onTranslation, onError, language, targetLanguage]);

  const stop = useCallback(() => {
    console.log("🛑 Stopping real-time speech recognition...");
    setListening(false);
    stopAudioCapture();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_transcription" }));
      wsRef.current.close();
    }
    wsRef.current = null; // Reset WebSocket reference

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null; // Reset MediaRecorder reference

    setInterimTranscript("");
    setFinalTranscript("");
    accumulatedTranscriptRef.current = ""; // Reset accumulated transcript
    setConfidence(1);
  }, []);

  // Function to update target language
  const updateTargetLanguage = useCallback((newTargetLang: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("🌐 Updating target language to:", newTargetLang);
      wsRef.current.send(JSON.stringify({ 
        type: "update_target_language", 
        targetLang: newTargetLang 
      }));
    }
  }, []);

  // Function to update source language
  const updateSourceLanguage = useCallback((newSourceLang: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("🌐 Updating source language to:", newSourceLang);
      wsRef.current.send(JSON.stringify({ 
        type: "update_source_language", 
        sourceLang: newSourceLang 
      }));
    }
  }, []);

  // Restart recognition if language changes
  useEffect(() => {
    if (listening) {
      stop();
    }
    // eslint-disable-next-line
  }, [language]);

  // Update languages in real-time if already listening
  useEffect(() => { 
    if (listening && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      updateSourceLanguage(language);
    }
  }, [language, listening, updateSourceLanguage]);

  useEffect(() => {
    if (listening && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      updateTargetLanguage(targetLanguage);
    }
  }, [targetLanguage, listening, updateTargetLanguage]);

  // Stop if tab hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && listening) {
        stop();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [listening, stop]);

  return {
    listening,
    start,
    stop,
    updateTargetLanguage,
    updateSourceLanguage,
    audioLevel,
    transcript: finalTranscript + (interimTranscript ? "\n" + interimTranscript : ""),
    confidence,
    isProcessing: false,
    provider: "deepgram",
  };
}