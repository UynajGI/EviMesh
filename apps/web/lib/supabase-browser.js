import { createClient } from '@supabase/supabase-js';

let browserClient;

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public configuration is unavailable.');
  const client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  // Share storage, refresh, and auth events across all browser consumers.
  // Never cache an auth client across server requests.
  if (typeof window !== 'undefined') browserClient = client;
  return client;
}
