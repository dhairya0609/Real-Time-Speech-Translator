import React, { useEffect, useRef } from "react";

type Props = {
  text: string;
  language: string;
  error?: string;
  isStreaming?: boolean;
  className?: string;
  maxLines?: number;
};

const TranscriptDisplay: React.FC<Props> = ({
  text,
  language,
  error,
  isStreaming,
  className = "",
  maxLines = 15, // Maximum number of lines to show
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

  return (
    <div className={`w-full h-full ${className}`}>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <div 
        ref={textRef}
        className={`w-full h-full min-h-[120px] bg-gray-50 dark:bg-gray-800 rounded p-4 overflow-y-auto shadow-inner transition-all text-lg font-mono leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap ${
          isStreaming ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''
        }`}
      >
        {limitedText}
        {isStreaming && <span className="blinking-cursor">|</span>}
      </div>
    </div>
  );
};

export default TranscriptDisplay;