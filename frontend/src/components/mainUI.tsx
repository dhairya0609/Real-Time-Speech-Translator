import React, { useState, useEffect } from "react";
import { MicrophoneIcon, StopIcon, GlobeAltIcon, BoltIcon, SunIcon, MoonIcon } from "@heroicons/react/24/solid";
import LanguageSelector from "./LanguageSelector";
import TranscriptDisplay from "./TranscriptDisplay";
import { ErrorBoundary } from "./ErrorBoundary";
import { Switch } from "@headlessui/react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import languageList from "../utils/languageList";

const statusIcons = {
  listening: <MicrophoneIcon className="w-4 h-4 text-violet-500 inline" />,
  translating: <GlobeAltIcon className="w-4 h-4 text-emerald-500 inline" />,
  connected: <BoltIcon className="w-4 h-4 text-cyan-500 inline" />,
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
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f5f7fa] via-white to-blue-50 dark:from-[#0f0f11] dark:via-gray-900 dark:to-gray-800 transition-all duration-500 font-sans">
        {/* Header with glassmorphism */}
        <header className="flex items-center justify-between px-6 py-4 card-glass mx-4 mt-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                <GlobeAltIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent gradient-shift">
                  Live Speech Translator
                </h1>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">Real-time Speech translation</p>
              </div>
            </div>
            {/*             <span className="px-2 py-1 rounded-full bg-gradient-to-r from-violet-500/20 to-indigo-500/20 text-violet-800 dark:text-violet-200 text-xs font-semibold border border-violet-200 dark:border-violet-800">
              BETA
            </span> */}
          </div>
          
          {/* Theme toggle with glassmorphism */}
          <div className="flex items-center gap-2 card-glass px-3 py-1">
            <SunIcon className="w-4 h-4 text-amber-500" />
            <Switch
              checked={isDark}
              onChange={setIsDark}
              className={`${
                isDark ? "bg-gradient-to-r from-violet-500 to-indigo-600" : "bg-gradient-to-r from-gray-200 to-gray-300"
              } relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 shadow-lg`}
              aria-label="Toggle dark mode"
            >
              <span
                className={`${
                  isDark ? "translate-x-6" : "translate-x-1"
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-md`}
              />
            </Switch>
            <MoonIcon className="w-4 h-4 text-indigo-500" />
          </div>
        </header>

        {/* Language selectors with glassmorphism */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 card-glass mx-4 mb-3">
          <div className="flex gap-6 flex-wrap">
            <LanguageSelector value={sourceLang} onChange={setSourceLang} label="Source Language" />
            <LanguageSelector value={targetLang} onChange={setTargetLang} label="Target Language" />
          </div>
        </div>

        {/* Status indicators with glassmorphism */}
        <div className="flex items-center justify-center gap-6 py-3 card-glass mx-4 mb-4">
          <Status label="Listening" active={listening} icon={statusIcons.listening} />
          <Status label="Processing" active={isProcessing} icon={statusIcons.translating} />
          <Status label="Connected" active={true} icon={statusIcons.connected} />
        </div>

        {/* Main split-screen with glassmorphism */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden gap-4 px-6 pb-20">
          {/* Original text */}
          <section className="w-full md:w-1/2 flex flex-col">
            <div className="card-glass p-4 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <GlobeAltIcon className="w-3 h-3 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  Original ({getLanguageName(sourceLang)})
                </h2>
              </div>
              <div className="flex-1 min-h-[150px]">
                <TranscriptDisplay
                  text={recognized}
                  language={sourceLang}
                  isStreaming={listening}
                  className="h-full"
                  isTranslation={false}
                />
              </div>
            </div>
          </section>
          
          {/* Translated text */}
          <section className="w-full md:w-1/2 flex flex-col">
            <div className="card-glass p-4 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-lg flex items-center justify-center">
                  <BoltIcon className="w-3 h-3 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  Translated ({getLanguageName(targetLang)})
                </h2>
              </div>
              <div className="flex-1 min-h-[150px]">
                <TranscriptDisplay
                  text={translated}
                  language={targetLang}
                  isStreaming={isProcessing}
                  className="h-full"
                  isTranslation={true}
                />
              </div>
            </div>
          </section>
        </main>

        {/* Central controls with stunning mic button */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center">
          <button
            ref={startStopBtnRef}
            className={`relative rounded-full p-4 text-lg font-bold shadow-xl focus:outline-none focus:ring-4 focus:ring-violet-300/50 transition-all duration-300 transform hover:scale-110 ${
              listening 
                ? "bg-gradient-to-r from-red-500 to-pink-600 text-white pulse-glow" 
                : "bg-gradient-to-r from-violet-500 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-700"
            }`}
            onClick={() => listening ? handleStop() : handleStart()}
            aria-pressed={listening}
            aria-label={listening ? "Stop recording" : "Start recording"}
            tabIndex={0}
          >
            {listening ? (
              <>
                <StopIcon className="w-6 h-6 inline mr-2" />
                Stop
              </>
            ) : (
              <>
                <MicrophoneIcon className="w-6 h-6 inline mr-2" />
                Start
              </>
            )}
          </button>
          
          {/* Audio level bar with gradient */}
          <div className="mt-4 w-64 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden card-glass">
            <div
              className="h-3 bg-gradient-to-r from-emerald-400 via-cyan-500 to-violet-500 transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
            />
          </div>
          
          {error && (
            <div className="mt-3 card-glass px-4 py-2 text-red-600 dark:text-red-400 font-semibold text-center max-w-xs text-sm">
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
  <div className="flex items-center gap-2 card-glass px-3 py-1">
    <span
      className={`inline-block w-2 h-2 rounded-full transition-all duration-300 ${
        active 
          ? "bg-gradient-to-r from-violet-500 to-indigo-600 shadow-lg" 
          : "bg-gray-300 dark:bg-gray-600"
      }`}
      aria-label={label}
    />
    <span className="text-violet-500">{icon}</span>
    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{label}</span>
  </div>
);

export default MainUI;