'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'evimesh-theme';

/*
 * M13.8: manual theme override on top of the system default. The layout
 * bootstrap resolves "auto" to a concrete value before first paint and keeps
 * it live on system changes, so this component only flips the attribute and
 * persists the choice; the stylesheet carries a single [data-theme="dark"]
 * block with no prefers-color-scheme duplicate.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const sync = () => {
      let manual = null;
      try {
        manual = localStorage.getItem(STORAGE_KEY);
      } catch {
        manual = null;
      }
      if (manual !== 'light' && manual !== 'dark') {
        setDark(document.documentElement.getAttribute('data-theme') === 'dark');
      }
    };
    if (media && media.addEventListener) media.addEventListener('change', sync);
    return () => {
      if (media && media.removeEventListener) media.removeEventListener('change', sync);
    };
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const value = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* storage unavailable: session-only preference */
    }
  }

  return (
    <button
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={toggle}
      type="button"
    >
      {dark ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
    </button>
  );
}
