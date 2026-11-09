'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createAdmissionClient } from '@/lib/admission-client.mjs';

/** Generic async read with reload. `enabled = false` keeps it idle. */
export function useResource(read, deps = [], enabled = true) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', data: null, error: null });
  const load = useCallback(async () => {
    if (!enabled) { setState({ status: 'idle', data: null, error: null }); return; }
    setState((current) => ({ ...current, status: current.data ? 'refreshing' : 'loading', error: null }));
    try {
      setState({ status: 'ready', data: await read(), error: null });
    } catch (error) {
      setState({ status: 'error', data: null, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

/**
 * Read one admission resource for the signed-in person and expose a reload.
 * `read(client)` returns a promise; errors keep their AdmissionError status
 * so pages can tell an expired session from a missing role.
 */
export function useAdmissionResource(session, read, deps = []) {
  const token = session?.access_token ?? null;
  const client = useMemo(() => (token ? createAdmissionClient({ access_token: token }) : null), [token]);
  const resource = useResource(() => read(client), [client, ...deps], Boolean(client));
  return { ...resource, client };
}

/**
 * Run one write against the admission API with a pending flag and a typed
 * error, then let the caller refresh. Returns the payload or null on failure.
 */
export function useAdmissionAction() {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const run = useCallback(async (key, action) => {
    setPending(key);
    setError(null);
    try {
      return await action();
    } catch (reason) {
      setError({ key, error: reason });
      return null;
    } finally {
      setPending(null);
    }
  }, []);
  return { pending, error, run, clearError: () => setError(null) };
}

export function canonicalId(prefix) {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  return `${prefix}_${uuid}`;
}
