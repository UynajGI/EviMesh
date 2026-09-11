'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

const AuthContext = createContext({ session: null, ready: false });

export function AuthProvider({ children }) {
  const [state, setState] = useState({ session: null, ready: false });

  useEffect(() => {
    let active = true;
    let subscription;
    try {
      const { auth } = createBrowserSupabaseClient();
      // INITIAL_SESSION follows storage/redirect recovery. Later events keep
      // navigation in sync with sign-in, refresh, and sign-out in other tabs.
      ({ data: { subscription } } = auth.onAuthStateChange((_event, session) => {
        if (active) setState({ session, ready: true });
      }));
    } catch {
      // Public browsing remains available in unconfigured local environments.
      setState({ session: null, ready: true });
    }
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
