'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form';
import { PageContainer } from '@/components/ui/page';
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

  return <PageContainer><div className="mx-auto flex min-h-[70vh] max-w-md items-center"><section className="w-full rounded-lg border border-border bg-card p-8" aria-labelledby="sign-in-heading"><p className="text-sm font-medium text-secondary-foreground">Welcome back</p><h1 id="sign-in-heading" className="mt-3 text-3xl font-semibold tracking-tight">Sign in to EviMesh</h1><p className="mt-3 text-sm text-muted-foreground">You will return to the page you were viewing after signing in.</p><form className="mt-7 space-y-4" onSubmit={signInWithEmail}><div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" required type="email" autoComplete="email" /></div><div className="grid gap-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" required type="password" autoComplete="current-password" /></div><Button className="w-full" loading={pending} type="submit">{pending ? 'Signing in…' : 'Sign in with email'}</Button></form><div className="my-6 border-t border-border" role="separator" /><Button className="w-full" disabled={pending} onClick={signInWithGitHub} type="button" variant="outline">Continue with GitHub</Button><p className="mt-5 text-xs leading-5 text-muted-foreground">Your credentials are handled by Supabase Auth. EviMesh never stores your password or GitHub token.</p>{message && <p role={message === 'Signed in successfully.' ? 'status' : 'alert'} aria-live="polite" className={`mt-5 text-sm ${message === 'Signed in successfully.' ? 'text-success' : 'text-destructive'}`}>{message}</p>}</section></div></PageContainer>;
}
