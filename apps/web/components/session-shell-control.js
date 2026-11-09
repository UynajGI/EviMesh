'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import {
  clearAuthenticatedSessionMarker,
  markAuthenticatedSession,
  missingSessionStatus,
} from '@/lib/auth-session.mjs';

const INITIAL_SESSION = Object.freeze({
  status: 'loading',
  session: null,
  error: null,
  signingOut: false,
});

/**
 * The shared page-shell view of Supabase Auth. Authorization remains on the
 * API; this hook only keeps navigation honest about the browser session.
 */
export function useBrowserSession() {
  const [state, setState] = useState(INITIAL_SESSION);
  const clientRef = useRef(null);
  const explicitSignOut = useRef(false);

  useEffect(() => {
    let mounted = true;
    let subscription = null;
    try {
      const client = createBrowserSupabaseClient();
      clientRef.current = client;
      ({ data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (session) {
          markAuthenticatedSession(window.localStorage);
          setState({ status: 'authenticated', session, error: null, signingOut: false });
          return;
        }

        if (event === 'SIGNED_OUT' && explicitSignOut.current) {
          explicitSignOut.current = false;
          clearAuthenticatedSessionMarker(window.localStorage);
          setState({ status: 'anonymous', session: null, error: null, signingOut: false });
          return;
        }

        setState({
          status: missingSessionStatus(window.localStorage),
          session: null,
          error: null,
          signingOut: false,
        });
      }));
    } catch (error) {
      setState({
        status: 'error',
        session: null,
        error: error.message ?? 'The browser session is unavailable.',
        signingOut: false,
      });
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return false;
    explicitSignOut.current = true;
    setState((current) => ({ ...current, error: null, signingOut: true }));
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      /* The SIGNED_OUT listener normally wins. Keep this fallback for clients
       * that complete storage cleanup without dispatching the event. */
      clearAuthenticatedSessionMarker(window.localStorage);
      setState({ status: 'anonymous', session: null, error: null, signingOut: false });
      explicitSignOut.current = false;
      return true;
    } catch (error) {
      explicitSignOut.current = false;
      setState((current) => ({
        ...current,
        error: error.message ?? 'Sign out failed. Please try again.',
        signingOut: false,
      }));
      return false;
    }
  }, []);

  return { ...state, signOut };
}
