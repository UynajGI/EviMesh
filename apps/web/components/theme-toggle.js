'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'evimesh-theme';

/** True when the effective theme (attribute or system) is dark. */
function systemDark() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/*
 * M13.8: manual theme override on top of the system default. The attribute is
 * applied before first paint by the inline snippet in app/layout.js; this
 * component only flips it and persists the choice.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    setDark(attr === 'dark' || (attr !== 'light' && systemDark()));
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
