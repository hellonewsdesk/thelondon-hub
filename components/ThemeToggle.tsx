'use client';

import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from './ThemeScript';

type Theme = 'light' | 'dark';

/**
 * Light / dark switch — lives in the topbar, on the chrome.
 *
 * A two-button segmented control rather than a single cycling button: the
 * reader can see which mode is active and pick the other one directly,
 * instead of clicking blind and hoping. `aria-pressed` carries that state to
 * assistive tech.
 *
 * ThemeScript has already set `data-theme` before paint, so this component
 * only reads it back and writes changes. It renders inert placeholders until
 * mounted — the server cannot know the reader's stored choice, and guessing
 * would produce a hydration mismatch.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');

    // Follow the OS while the reader has made no explicit choice.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        // Storage unavailable — fall through and follow the OS.
      }
      const next: Theme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      setTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function choose(next: Theme) {
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Choice still applies for this page view.
    }
  }

  return (
    <div className={`theme-toggle ${className}`} role="group" aria-label="Colour theme">
      <button
        type="button"
        className="theme-toggle__btn"
        aria-pressed={theme === 'light'}
        aria-label="Light theme"
        onClick={() => choose('light')}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="3.1" />
          <path d="M8 .9v2M8 13.1v2M.9 8h2M13.1 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" strokeLinecap="square" />
        </svg>
      </button>

      <button
        type="button"
        className="theme-toggle__btn"
        aria-pressed={theme === 'dark'}
        aria-label="Dark theme"
        onClick={() => choose('dark')}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
          <path d="M13.5 9.6A5.9 5.9 0 0 1 6.4 2.5a5.9 5.9 0 1 0 7.1 7.1Z" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
