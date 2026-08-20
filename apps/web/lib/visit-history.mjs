'use client';

import { useEffect } from 'react';

/*
 * Recently visited (M13.8 05-core-ui-spec.md §2 home rail): a purely local,
 * per-browser history of opened objects. It never leaves the device, carries
 * no identifiers beyond the public permalinks themselves, and is capped so
 * the rail stays a navigation aid rather than a profile.
 */

const STORAGE_KEY = 'evimesh.visit-history.v1';
const CAP = 8;

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readVisitHistory() {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.href === 'string' && typeof entry.label === 'string' && typeof entry.kind === 'string').slice(0, CAP);
  } catch {
    return [];
  }
}

export function recordVisit({ href, label, kind }) {
  if (typeof href !== 'string' || typeof label !== 'string' || label.trim() === '' || typeof kind !== 'string') return;
  const storage = safeStorage();
  if (!storage) return;
  const next = [{ href, label: label.trim().slice(0, 120), kind }, ...readVisitHistory().filter((entry) => entry.href !== href)].slice(0, CAP);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: history is best-effort */
  }
}

export function clearVisitHistory() {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}

/** Record one detail-page visit once its readable label is available. */
export function useVisitRecord({ href, label, kind }) {
  useEffect(() => {
    if (href && label) recordVisit({ href, label, kind });
  }, [href, label, kind]);
}
