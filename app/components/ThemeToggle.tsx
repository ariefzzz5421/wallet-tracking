"use client";

const THEME_KEY = "huntlist-theme-v1";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    window.localStorage.setItem(THEME_KEY, next);
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark and light theme" title="Toggle theme">
      <span className="theme-icon theme-icon-moon" aria-hidden="true">☾</span>
      <span className="theme-icon theme-icon-sun" aria-hidden="true">☀</span>
    </button>
  );
}
