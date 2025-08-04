import React, { useEffect, useRef } from "react";
import { ClockIcon } from "@heroicons/react/24/outline";

type Props = {
  text: string;
  language: string;
  error?: string;
  isStreaming?: boolean;
  className?: string;
  maxLines?: number;
  isTranslation?: boolean;
};

const TranscriptDisplay: React.FC<Props> = ({
  text,
  language,
  error,
  isStreaming,
  className = "",
  maxLines = 15, // Maximum number of lines to show
  isTranslation = false,
}) => {
  const textRef = useRef<HTMLDivElement>(null);

  // Function to limit text to maxLines
  const limitTextToLines = (text: string, maxLines: number) => {
    const lines = text.split('\n');
    if (lines.length > maxLines) {
      return lines.slice(-maxLines).join('\n');
    }
    return text;
  };

  // Auto-scroll to bottom when new text is added
  useEffect(() => {
    if (textRef.current) {
      const scrollToBottom = () => {
        textRef.current!.scrollTop = textRef.current!.scrollHeight;
      };
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(scrollToBottom);
    }
  }, [text]);

  // Limit text to maxLines
  const limitedText = limitTextToLines(text, maxLines);

  // Format current time for timestamp
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`w-full h-full ${className}`}>
      {error && (
        <div className="mb-2 sm:mb-3 p-2 card-glass text-red-600 dark:text-red-400 text-xs font-medium">
          ⚠️ {error}
        </div>
      )}
      
      <div 
        ref={textRef}
        className={`w-full h-full min-h-[100px] sm:min-h-[120px] card-glass p-2 sm:p-3 overflow-y-auto transition-all duration-300 ${
          isStreaming ? 'ring-2 ring-violet-200 dark:ring-violet-800' : ''
        }`}
      >
        {limitedText ? (
          <div className="space-y-2 sm:space-y-3">
            {/* Message bubbles for each line */}
            {limitedText.split('\n').map((line, index) => (
              <div key={index} className="flex flex-col">
                {line.trim() && (
                  <>
                    {/* Timestamp */}
                    <div className="flex items-center gap-1 mb-1">
                      <ClockIcon className="w-1.5 h-1.5 sm:w-2 sm:h-2 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {getCurrentTime()}
                      </span>
                    </div>
                    
                    {/* Message bubble */}
                    <div className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 dark:from-violet-500/20 dark:to-indigo-500/20 rounded-xl p-1.5 sm:p-2 border border-violet-200/50 dark:border-violet-800/50">
                      <p className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed text-xs sm:text-sm">
                        {line}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex items-center gap-1.5 sm:gap-2 mt-2">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-violet-500 rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                  Listening...
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-r from-violet-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mb-2 sm:mb-3">
              <ClockIcon className="w-4 h-4 sm:w-6 sm:h-6 text-violet-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium text-xs sm:text-sm">
              {isStreaming ? "Listening for speech..." : (isTranslation ? "No translation yet" : "No transcript yet")}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {isStreaming ? "Speak clearly into your microphone" : "Click Start to begin recording"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptDisplay;