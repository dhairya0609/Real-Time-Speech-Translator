import React from "react";
import { ChatBubbleLeftRightIcon, LockClosedIcon, SparklesIcon } from "@heroicons/react/20/solid";
import Sheet from "./Sheet";
import { LogoMark } from "./Logo";

const Row: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex gap-3">
    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-raised text-muted">{icon}</span>
    <div>
      <p className="font-medium text-fg">{title}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  </div>
);

const AboutSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Sheet open={open} onClose={onClose} title="About">
    <div className="mb-6 flex items-center gap-3">
      <LogoMark className="h-11 w-11" />
      <div>
        <p className="text-[15px] font-semibold tracking-tight text-fg">Live Translator</p>
        <p>Real-time voice and text translation for conversations.</p>
      </div>
    </div>
    <div className="space-y-5">
      <Row icon={<ChatBubbleLeftRightIcon className="h-4 w-4" />} title="Made for conversations">
        Speak or type. Each finished sentence is translated with the lines before it in mind, so names, pronouns and tone
        carry through. Swap languages to let the other person reply, or use Face to face to put the phone between you.
      </Row>
      <Row icon={<SparklesIcon className="h-4 w-4" />} title="More than a translation">
        Tap a translation for other ways to say it, show pronunciation in Latin letters, star phrases to keep them, and get
        a short summary with action items in both languages.
      </Row>
      <Row icon={<LockClosedIcon className="h-4 w-4" />} title="Private by default">
        Audio is streamed only to transcribe it and is never stored. History and saved phrases are kept only in this
        browser, never on a server or in an account; turn history off or delete it anytime from History. Speech and text are
        sent to our speech and translation providers to produce results.
      </Row>
    </div>
    <p className="mt-6 border-t border-line pt-4 text-xs text-subtle">
      Machine translation can make mistakes. Double-check anything important.
    </p>
  </Sheet>
);

export default AboutSheet;
