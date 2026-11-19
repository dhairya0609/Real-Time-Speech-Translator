import React from "react";
import { MicrophoneIcon, NoSymbolIcon } from "@heroicons/react/24/outline";
import Sheet from "./Sheet";

type Props = {
  mode: "prompt" | "denied" | null;
  onContinue: () => void;
  onClose: () => void;
  onType: () => void;
};

const MicPrimer: React.FC<Props> = ({ mode, onContinue, onClose, onType }) => {
  const denied = mode === "denied";
  return (
    <Sheet
      open={mode !== null}
      onClose={onClose}
      title={denied ? "Microphone is blocked" : "Use your microphone"}
      footer={
        denied ? (
          <>
            <button type="button" className="btn" onClick={onType}>
              Type instead
            </button>
            <button type="button" className="btn-primary" onClick={onContinue}>
              Try again
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Not now
            </button>
            <button type="button" className="btn-primary" data-autofocus onClick={onContinue}>
              Continue
            </button>
          </>
        )
      }
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
        {denied ? <NoSymbolIcon className="h-6 w-6" /> : <MicrophoneIcon className="h-6 w-6" />}
      </div>
      {denied ? (
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Click the lock or settings icon next to the address bar.</li>
          <li>Set Microphone to Allow.</li>
          <li>Come back here and tap Try again.</li>
        </ol>
      ) : (
        <p>
          Your browser will ask to use the microphone. Audio is used only to transcribe what you say, and it is never
          stored.
        </p>
      )}
    </Sheet>
  );
};

export default MicPrimer;
