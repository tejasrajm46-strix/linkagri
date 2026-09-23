import type { Config } from "tailwindcss";

/**
 * Semantic tokens (surface / card / elevated / ink / line) are RGB channel
 * triples defined in src/app/globals.css. Light and dark both swap those
 * variables, so every page written with `bg-card` / `text-ink` /
 * `border-line/10` follows the theme without a `dark:` variant of its own.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7f2",
          100: "#e2efe8",
          200: "#c3dfcd",
          300: "#9cc9ab",
          400: "#6fae85",
          500: "#388e3c",
          600: "#2f7d33",
          700: "#2a6b2f",
          800: "#1f5425",
          900: "#163d1b",
        },
        leaf: {
          DEFAULT: "#163d1b",
          light: "#3b7a57",
        },
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          muted: "rgb(var(--c-ink-muted) / <alpha-value>)",
          faint: "rgb(var(--c-ink-faint) / <alpha-value>)",
        },
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        card: "rgb(var(--c-card) / <alpha-value>)",
        elevated: "rgb(var(--c-elevated) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(16, 40, 24, 0.06), 0 4px 12px rgba(16, 40, 24, 0.04)",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-120%)" },
          "100%": { transform: "translateY(120%)" },
        },
        pulseRing: {
          "0%, 100%": { opacity: "0.35", transform: "scale(0.94)" },
          "50%": { opacity: "0.9", transform: "scale(1.04)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        scan: "scan 3.4s linear infinite",
        "pulse-ring": "pulseRing 2.6s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
