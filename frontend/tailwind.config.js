/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        raised: token("raised"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        subtle: token("subtle"),
        accent: token("accent"),
        "accent-fg": token("accent-fg"),
        danger: token("danger"),
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)",
        pop: "0 12px 32px -8px rgb(0 0 0 / 0.18), 0 2px 6px rgb(0 0 0 / 0.06)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        caret: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0" } },
        ring: {
          from: { transform: "scale(1)", opacity: "0.35" },
          to: { transform: "scale(1.6)", opacity: "0" },
        },
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "sheet-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "fade-up": "fade-up 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "fade-in": "fade-in 160ms ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
        caret: "caret 1s steps(1) infinite",
        ring: "ring 1.6s cubic-bezier(0.2, 0.6, 0.3, 1) infinite",
        "sheet-up": "sheet-up 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "sheet-in": "sheet-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
      },
    },
  },
  plugins: [],
};
