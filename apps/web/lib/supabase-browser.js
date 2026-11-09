import { createClient } from '@supabase/supabase-js';

let browserClient = null;

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public configuration is unavailable.');
  /* One browser client owns session refresh, URL callback detection, and auth
   * notifications. Creating a client per component would duplicate listeners
   * and make the shell disagree with the page that signed out. Never cache an
   * auth client across server requests. */
  const client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  if (typeof window !== 'undefined') browserClient = client;
  return client;
}
