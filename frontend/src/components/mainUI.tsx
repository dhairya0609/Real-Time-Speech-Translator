import React, { useState, useEffect } from "react";
import { MicrophoneIcon, StopIcon, GlobeAltIcon, BoltIcon } from "@heroicons/react/24/solid";
import LanguageSelector from "./LanguageSelector";
import TranscriptDisplay from "./TranscriptDisplay";
import { ErrorBoundary } from "./ErrorBoundary";
import { Switch } from "@headlessui/react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import languageList from "../utils/languageList";

const statusIcons = {
  listening: <MicrophoneIcon className="w-5 h-5 text-blue-500 inline" />,
  translating: <GlobeAltIcon className="w-5 h-5 text-green-500 inline" />,
  connected: <BoltIcon className="w-5 h-5 text-teal-500 inline" />,
};

const MainUI: React.FC = () => {
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("hi");
  const [recognized, setRecognized] = useState("");
  const [translated, setTranslated] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isDark, setIsDark] = useState(false);

  // Get language names for display
  const getLanguageName = (code: string) => {
    const lang = languageList.find(l => l.code === code);
    return lang ? lang.name : code.toUpperCase();
  };

  // Theme toggle
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Speech recognition hook
  const {
    listening,
    start,
    stop,
    updateTargetLanguage,
    updateSourceLanguage,
    audioLevel,
    transcript,
    confidence,
    isProcessing,
  } = useSpeechRecognition({
    language: sourceLang,
    targetLanguage: targetLang,
    onResult: (result) => {
      console.log("📝 MainUI received transcript:", result.transcript);
      setRecognized(result.transcript);
      setError(undefined);
    },
    onTranslation: (translation) => {
      console.log("🔄 MainUI received translation:", translation);
      setTranslated(prev => prev + (prev ? "\n" : "") + translation.translated);
    },
    onError: setError,
  });

  // Update languages when they change
  useEffect(() => {
    if (listening) {
      updateSourceLanguage(sourceLang);
    }
  }, [sourceLang, listening, updateSourceLanguage]);

  useEffect(() => {
    if (listening) {
      updateTargetLanguage(targetLang);
    }
  }, [targetLang, listening, updateTargetLanguage]);

  // Clear transcripts when languages change
  useEffect(() => {
    setRecognized("");
    setTranslated("");
  }, [sourceLang, targetLang]);

  // Clear transcript when starting new session
  const handleStart = () => {
    if (!listening) {
      setRecognized("");
      setTranslated("");
      setError(undefined);
    }
    start();
  };

  const handleStop = () => {
    stop();
  };

  // Accessibility: focus on start/stop button with keyboard
  const startStopBtnRef = React.useRef<HTMLButtonElement>(null);

  // Add effect to restart recognition on sourceLang change
  useEffect(() => {
    if (listening) {
      stop();
      setTimeout(() => start(), 200); // Small delay to allow cleanup
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceLang]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors font-sans">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 shadow-sm bg-white dark:bg-gray-900">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-teal-400 bg-clip-text text-transparent">
              Live Speech Translator
            </span>
            <span className="ml-2 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold dark:bg-blue-900 dark:text-blue-200">
              BETA
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              checked={isDark}
              onChange={setIsDark}
              className={`${
                isDark ? "bg-blue-600" : "bg-gray-300"
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
              aria-label="Toggle dark mode"
            >
              <span
                className={`${
                  isDark ? "translate-x-6" : "translate-x-1"
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <span className="text-sm text-gray-600 dark:text-gray-300">Dark Mode</span>
          </div>
        </header>

        {/* Language selectors and settings */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 gap-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-6 flex-wrap">
            <LanguageSelector value={sourceLang} onChange={setSourceLang} label="Source" />
            <LanguageSelector value={targetLang} onChange={setTargetLang} label="Target" />
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center justify-center gap-8 py-3 bg-gray-100 dark:bg-gray-800">
          <Status label="Listening" active={listening} icon={statusIcons.listening} />
          <Status label="Processing" active={isProcessing} icon={statusIcons.translating} />
          <Status label="Connected" active={true} icon={statusIcons.connected} />
        </div>

        {/* Main split-screen */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden gap-8 px-8 py-8">
          {/* Original text */}
          <section className="w-full md:w-1/2 flex flex-col">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 flex flex-col h-full">
              <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">Original ({getLanguageName(sourceLang)})</h2>
              <div className="flex-1 min-h-[200px]">
                <TranscriptDisplay
                  text={recognized}
                  language={sourceLang}
                  isStreaming={listening}
                  className="h-full"
                />
              </div>
            </div>
          </section>
          {/* Translated text */}
          <section className="w-full md:w-1/2 flex flex-col">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 flex flex-col h-full">
              <h2 className="text-xl font-bold text-teal-700 dark:text-teal-300 mb-4">Translated ({getLanguageName(targetLang)})</h2>
              <div className="flex-1 min-h-[200px]">
                <TranscriptDisplay
                  text={translated}
                  language={targetLang}
                  isStreaming={isProcessing}
                  className="h-full"
                />
              </div>
            </div>
          </section>
        </main>

        {/* Central controls */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center">
          <button
            ref={startStopBtnRef}
            className={`rounded-full px-12 py-5 text-2xl font-bold shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all
              ${listening ? "bg-red-600 text-white" : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"}
              hover:scale-105`}
            onClick={() => listening ? handleStop() : handleStart()}
            aria-pressed={listening}
            aria-label={listening ? "Stop recording" : "Start recording"}
            tabIndex={0}
          >
            {listening ? (
              <>
                <StopIcon className="w-7 h-7 inline mr-2" />
                Stop
              </>
            ) : (
              <>
                <MicrophoneIcon className="w-7 h-7 inline mr-2" />
                Start
              </>
            )}
          </button>
          {/* Audio level bar */}
          <div className="mt-4 w-64 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-3 bg-gradient-to-r from-green-400 to-blue-500 transition-all"
              style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
            />
          </div>
          {error && (
            <div className="mt-2 text-red-600 font-semibold text-center max-w-xs">
              {error}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

const Status: React.FC<{ label: string; active: boolean; icon: React.ReactNode }> = ({
  label,
  active,
  icon,
}) => (
  <div className="flex items-center gap-1">
    <span
      className={`inline-block w-3 h-3 rounded-full ${
        active ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
      }`}
      aria-label={label}
    />
    {icon}
    <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
  </div>
);

export default MainUI;