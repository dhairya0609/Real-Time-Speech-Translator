import React, { useEffect, useRef } from "react";

type Props = {
  analyser: AnalyserNode | null;
  active: boolean;
  /** Width in CSS px kept clear in the middle (where the mic button sits). */
  gap: number;
  className?: string;
};

const BAR = 3;
const SPACE = 3;
const STEP_MS = 50;

function cssColor(name: string, alpha: number) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "113 113 122";
  return `rgb(${v} / ${alpha})`;
}

/**
 * Live level meter: RMS of the mic signal, scrolled outward from the centre on
 * both sides so the newest sound sits next to the mic button.
 */
const Waveform: React.FC<Props> = ({ analyser, active, gap, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;

    let raf = 0;
    let lastStep = 0;
    let colors = { on: "", off: "" };
    const samples = analyser ? new Float32Array(analyser.fftSize) : null;
    if (!active) historyRef.current = [];

    const readColors = () => {
      colors = { on: cssColor("--accent", 1), off: cssColor("--subtle", 0.45) };
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const bar = BAR * dpr;
      const step = (BAR + SPACE) * dpr;
      const half = (w - gap * dpr) / 2;
      const perSide = Math.max(0, Math.floor(half / step));
      const history = historyRef.current;

      for (let i = 0; i < perSide; i++) {
        const level = history[history.length - 1 - i] ?? 0;
        const fade = 1 - (i / perSide) * 0.75;
        const bh = Math.max(bar, level * h * 0.92);
        const y = (h - bh) / 2;
        ctx.fillStyle = active && level > 0.02 ? colors.on : colors.off;
        ctx.globalAlpha = active ? fade : 0.9;
        const xr = w / 2 + (gap * dpr) / 2 + i * step;
        const xl = w / 2 - (gap * dpr) / 2 - i * step - bar;
        for (const x of [xl, xr]) {
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, bar, bh, bar / 2);
          else ctx.rect(x, y, bar, bh);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (t: number) => {
      if (analyser && samples && t - lastStep >= STEP_MS) {
        lastStep = t;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        historyRef.current.push(Math.min(1, Math.pow(rms * 5, 0.8)));
        if (historyRef.current.length > 400) historyRef.current.splice(0, historyRef.current.length - 400);
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    readColors();
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    const mo = new MutationObserver(() => {
      readColors();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    if (active && analyser) raf = requestAnimationFrame(tick);
    else draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [analyser, active, gap]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
};

export default Waveform;
