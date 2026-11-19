import React from "react";
import { hasDevanagari, romanizeDevanagari } from "../lib/romanize";

export function romanFor(text: string | undefined, server?: string) {
  if (!text) return undefined;
  if (server) return server;
  return hasDevanagari(text) ? romanizeDevanagari(text) : undefined;
}

type Props = {
  text: string;
  lang: string;
  romanized?: string;
  showRoman: boolean;
  className?: string;
  romanClassName?: string;
};

/** A line of translated text with its optional Latin-letter pronunciation underneath. */
const Translation: React.FC<Props> = ({ text, lang, romanized, showRoman, className, romanClassName }) => {
  const roman = showRoman ? romanFor(text, romanized) : undefined;
  return (
    <>
      <span className={className} lang={lang}>
        {text}
      </span>
      {roman && (
        <span className={`block text-muted ${romanClassName || "mt-1 text-[15px] font-normal leading-relaxed"}`} lang={`${lang}-Latn`}>
          {roman}
        </span>
      )}
    </>
  );
};

export default Translation;
