'use client';

/*
 * Personal engagement signals + the labeled "For you" rail (owner direction
 * 2026-08-21). Signals (helpful marks, saves, views) are private navigation
 * input: nothing here renders or carries public counts, and recommendation
 * output is a navigation surface — never a reorder of the chronological feed.
 */

import { useCallback, useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from './supabase-browser';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

export function interactionKey(objectType, objectId, kind) {
  return `${objectType}:${objectId}:${kind}`;
}

async function sessionToken() {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

async function callInteractions(path, { method = 'GET', body } = {}) {
  const token = await sessionToken();
  if (!token) {
    const error = new Error('Sign in to keep your own navigation signals.');
    error.code = 'INTERACTION_AUTH_REQUIRED';
    error.status = 401;
    throw error;
  }
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message ?? 'The request failed. Please try again.');
    error.code = payload.code ?? null;
    error.status = response.status;
    error.requestId = payload.request_id ?? null;
    throw error;
  }
  return payload;
}

/* First authenticated use self-provisions the actor binding; a 403 from an
 * unprovisioned identity triggers one provisioning retry. */
async function ensureActor() {
  const token = await sessionToken();
  if (!token) return false;
  const response = await fetch(`${API}/actors/self`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
  return response.ok;
}

export async function setInteraction(objectType, objectId, kind, active) {
  const attempt = () => (active
    ? callInteractions(`/interactions/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`, { method: 'PUT', body: { kind } })
    : callInteractions(`/interactions/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}?kind=${kind}`, { method: 'DELETE' }));
  try {
    return await attempt();
  } catch (error) {
    if (error.status === 403 && (error.code === 'ACTOR_IDENTITY_NOT_FOUND' || error.code === 'ACTOR_IDENTITY_UNAVAILABLE')) {
      if (await ensureActor()) return attempt();
    }
    throw error;
  }
}

export async function fetchMyInteractions(kinds = null) {
  const query = kinds && kinds.length ? `?kind=${kinds.join(',')}` : '';
  const payload = await callInteractions(`/interactions/mine${query}`);
  return payload.interactions ?? [];
}

export async function fetchRecommendations(limit = 12) {
  return callInteractions(`/recommendations?limit=${limit}`);
}

/* One view signal per object per browser session — fire and forget. */
export async function recordView(objectType, objectId) {
  try {
    const key = `evimesh.view-sent.${objectType}.${objectId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* storage unavailable */ }
  try { await setInteraction(objectType, objectId, 'view', true); } catch { /* views are best-effort */ }
}

/** Loads the viewer's signal set once and exposes optimistic toggles. */
export function useMyInteractions() {
  const [mine, setMine] = useState(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const rows = await fetchMyInteractions();
      setMine(new Set(rows.map((row) => interactionKey(row.objectType, row.objectId, row.kind))));
    } catch (error) {
      setMine(error.status === 401 || error.code === 'INTERACTION_AUTH_REQUIRED' ? null : new Set());
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const has = useCallback((objectType, objectId, kind) => Boolean(mine?.has(interactionKey(objectType, objectId, kind))), [mine]);

  const toggle = useCallback(async (objectType, objectId, kind) => {
    const nextActive = !has(objectType, objectId, kind);
    setMine((current) => {
      const next = new Set(current ?? []);
      const key = interactionKey(objectType, objectId, kind);
      if (nextActive) next.add(key);
      else next.delete(key);
      return next;
    });
    try {
      await setInteraction(objectType, objectId, kind, nextActive);
    } catch {
      reload();
    }
  }, [has, reload]);

  return { mine, ready, has, toggle, reload };
}
