import React from "react";

/** Two speech bubbles facing each other, for the face-to-face (split screen) mode. */
export const FaceToFaceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 3.2h12a1.3 1.3 0 0 1 1.3 1.3v3a1.3 1.3 0 0 1-1.3 1.3H8.2L5.6 6.9H4a1.3 1.3 0 0 1-1.3-1.3V4.5A1.3 1.3 0 0 1 4 3.2Z" transform="rotate(180 10 6)" />
    <path d="M4 11.2h12a1.3 1.3 0 0 1 1.3 1.3v3a1.3 1.3 0 0 1-1.3 1.3H8.2l-2.6 1.9v-1.9H4a1.3 1.3 0 0 1-1.3-1.3v-3A1.3 1.3 0 0 1 4 11.2Z" />
  </svg>
);
