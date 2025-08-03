// src/components/SpeechRecognition.tsx
import React, { useEffect } from "react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

export type SpeechRecognitionResult = {
  transcript: string;
  confidence?: number;
  isFinal?: boolean;
};

interface Props {
  language: string;
  targetLanguage: string;
  onResult: (result: SpeechRecognitionResult) => void;
  onTranslation?: (translation: { original: string; translated: string; targetLang: string }) => void;
  onError?: (error: string) => void;
}

const SpeechRecognition: React.FC<Props> = ({ 
  language, 
  targetLanguage,
  onResult, 
  onTranslation,
  onError 
}) => {
  const {
    listening,
    start,
    stop,
    audioLevel,
    confidence,
  } = useSpeechRecognition({
    language,
    targetLanguage,
    onResult,
    onTranslation: onTranslation || (() => {}),
    onError: onError || (() => {}),
  });

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <div style={{ marginTop: 24 }}>
      <button onClick={listening ? stop : start}>
        {listening ? "Stop Listening" : "Start Listening"}
      </button>
      <div style={{ marginTop: 12 }}>
        <strong>Status:</strong> {listening ? "Listening..." : "Not listening"}<br />
        <strong>Confidence:</strong> {confidence.toFixed(2)}<br />
        <strong>Fallback Engine:</strong> {"None"}<br />
        <strong>Audio Level:</strong> {audioLevel.toFixed(2)}
      </div>
    </div>
  );
};

export default SpeechRecognition;