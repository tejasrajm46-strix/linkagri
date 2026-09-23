"use client";

import React, { useEffect, useState } from "react";

export const THEME_KEY = "agrilink-theme";

/**
 * Light/dark switch for the app shell.
 *
 * The stored preference is applied by a blocking script in the root layout so
 * the first paint is already correct; this component only has to read that
 * state back and toggle it.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode — the toggle still works for this page view */
    }
    setTheme(next);
  };

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-line/[0.06] text-ink-muted hover:text-ink ${className}`}
    >
      {!mounted ? (
        <span className="w-5 h-5" />
      ) : isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
