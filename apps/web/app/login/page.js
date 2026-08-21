'use client';

// Layout lineage: adapted from TailAdmin's MIT-licensed SignInForm. See THIRD_PARTY_NOTICES.md.

/*
 * Sign-in (M13.8 06-personal-ui-spec.md): browser sign-in comes first —
 * GitHub OAuth today, ORCID the moment it is enabled in the Supabase
 * dashboard (the button set is read from /auth/v1/settings at runtime, so
 * the page never advertises a provider the backend would reject), plus
 * passwordless email. Research identity (ORCID) connects from Settings and
 * is OAuth-verified only; typing an iD never renders as verified.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Fingerprint, GitFork, Globe, Network } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

/* Known providers get their icon and display name; anything else the
 * backend enables still renders, generically — the button set follows the
 * live configuration instead of a hardcoded allowlist. */
const PROVIDER_ICONS = { github: GitFork, orcid: Fingerprint };
const PROVIDER_LABELS = { github: 'GitHub', orcid: 'ORCID', google: 'Google' };
const providerName = (provider) => PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
const providerIcon = (provider) => PROVIDER_ICONS[provider] ?? Globe;

export default function LoginPage() {
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('magic');
  const [providers, setProviders] = useState(null);

  /* Ask the auth service which providers are actually enabled: buttons
   * render from this list, so configuration is never contradicted. */
  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setProviders([]); return; }
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key, authorization: `Bearer ${key}` } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('settings unavailable'))))
      .then((settings) => {
        if (cancelled) return;
        const external = settings?.external ?? {};
        setProviders(Object.keys(external).filter((provider) => external[provider] === true));
      })
      .catch(() => { if (!cancelled) setProviders([]); });
    return () => { cancelled = true; };
  }, []);

  async function loginWithProvider(provider) {
    setPending(provider);
    setMessage(null);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/` } });
      if (error) throw error;
    } catch (error) {
      setMessage(error.message);
      setPending(null);
    }
  }

  async function submitEmail(event) {
    event.preventDefault();
    setPending('email');
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const email = form.get('email');
    const password = form.get('password');
    const auth = createBrowserSupabaseClient().auth;
    try {
      if (mode === 'magic') {
        const { error } = await auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/` } });
        if (error) throw error;
        setMessage(`Sign-in link sent to ${email}. It expires in one hour; open it on this device.`);
      } else if (mode === 'signup') {
        const { error } = await auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } });
        if (error) throw error;
        setMessage('Account created. If email confirmation is required, a link was sent to your address; otherwise switch to Password and sign in.');
        setMode('password');
      } else {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign('/');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPending(null);
    }
  }

  const providerButtons = (providers ?? [])
    .map((provider) => ({ provider, label: providerName(provider), Icon: providerIcon(provider) }));

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground" href="/"><ArrowLeft aria-hidden="true" size={16} />Back to EviMesh</Link>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Sign in to your account</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Continue your research workspace, manage API tokens, and connect identities.</p>
          </div>

          {providers === null ? (
            <div className="h-12 w-full animate-pulse rounded-lg border border-border bg-muted" aria-label="Loading sign-in providers" />
          ) : providerButtons.length === 0 ? (
            <p className="rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-status-warning-fg">No external provider is enabled. Use email below.</p>
          ) : (
            <div className="grid gap-3">
              {providerButtons.map(({ provider, label, Icon }) => (
                <button
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-card text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
                  disabled={pending !== null}
                  key={provider}
                  onClick={() => loginWithProvider(provider)}
                  type="button"
                >
                  <Icon aria-hidden="true" size={19} />
                  {pending === provider ? 'Redirecting…' : `Continue with ${label}`}
                </button>
              ))}
            </div>
          )}

          <div className="my-7 flex items-center gap-4"><span className="h-px flex-1 bg-border" /><span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">or email</span><span className="h-px flex-1 bg-border" /></div>

          <div className="mb-5 flex gap-1 rounded-lg border border-border bg-card p-1" role="tablist" aria-label="Email sign-in mode">
            {[['magic', 'Sign-in link'], ['password', 'Password'], ['signup', 'Create account']].map(([id, label]) => (
              <button
                aria-selected={mode === id}
                className={mode === id ? 'flex-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground' : 'flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'}
                key={id}
                onClick={() => { setMode(id); setMessage(null); }}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <form className="space-y-5" onSubmit={submitEmail}>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="email">Email</label>
              <input autoComplete="email" className="h-12 w-full rounded-lg border border-border bg-transparent px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-focus" id="email" name="email" placeholder="researcher@example.org" required type="email" />
            </div>
            {mode === 'magic' ? null : (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="password">{mode === 'signup' ? 'Choose a password' : 'Password'}</label>
                  {mode === 'password' ? <button className="text-xs font-medium text-primary hover:underline" onClick={() => setMode('magic')} type="button">Use a sign-in link instead</button> : null}
                </div>
                <div className="relative">
                  <input autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="h-12 w-full rounded-lg border border-border bg-transparent px-4 pr-12 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-focus" id="password" name="password" placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'} required minLength={mode === 'signup' ? 6 : undefined} type={showPassword ? 'text' : 'password'} />
                  <button aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
              </div>
            )}
            <button className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent-foreground/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={pending !== null} type="submit">
              {pending === 'email' ? 'Working…' : mode === 'magic' ? 'Email me a sign-in link' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {message ? <p aria-live="polite" className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-sm" role="alert">{message}</p> : null}

          {/* Registration stays one obvious step away, not a hidden tab. */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === 'signup' ? 'Already have an account?' : 'New to EviMesh?'}
            <button className="ml-1 font-medium text-primary hover:underline" onClick={() => setMode(mode === 'signup' ? 'magic' : 'signup')} type="button">
              {mode === 'signup' ? 'Sign in instead' : 'Create an account →'}
            </button>
          </p>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-muted lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(var(--evimesh-border)_1px,transparent_1px),linear-gradient(90deg,var(--evimesh-border)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative max-w-lg px-14 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Network aria-hidden="true" size={32} /></span>
          <h2 className="mt-8 text-3xl font-bold tracking-tight">Research records you can inspect, trace, and challenge.</h2>
          <p className="mt-5 leading-7 text-muted-foreground">Move between scientific questions, claim revisions, evidence relationships, verification findings, and the current frontier without losing provenance.</p>
          <p className="mt-6 text-xs text-muted-foreground"><Link className="font-medium text-primary hover:underline" href="/agent">Connecting an agent? Open the connection center →</Link></p>
        </div>
      </aside>
    </main>
  );
}
