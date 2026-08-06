'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export default function SignInPage() {
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState(false);

  async function signInWithEmail(event) {
    event.preventDefault();
    setPending(true); setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: form.get('email'), password: form.get('password') });
      if (error) throw error;
      setMessage('Signed in successfully.');
    } catch (error) { setMessage(error.message); } finally { setPending(false); }
  }

  async function signInWithGitHub() {
    setPending(true); setMessage(null);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${window.location.origin}/` } });
      if (error) throw error;
    } catch (error) { setMessage(error.message); setPending(false); }
  }

  return <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-6 py-16"><section className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Welcome back</p><h1 className="mt-3 text-3xl font-semibold text-card-foreground">Sign in to EviMesh</h1><form className="mt-7 space-y-4" onSubmit={signInWithEmail}><label className="block text-sm font-medium" htmlFor="email">Email</label><Input id="email" name="email" required type="email" /><label className="block text-sm font-medium" htmlFor="password">Password</label><Input id="password" name="password" required type="password" /><Button className="w-full" disabled={pending} type="submit">{pending ? 'Signing in…' : 'Sign in with email'}</Button></form><div className="my-6 border-t border-border" /><Button className="w-full" disabled={pending} onClick={signInWithGitHub} type="button" variant="outline">Continue with GitHub</Button>{message && <p aria-live="polite" className="mt-5 text-sm text-muted-foreground">{message}</p>}</section></main>;
}
