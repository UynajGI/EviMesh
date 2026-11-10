'use client';

// Layout lineage: adapted from TailAdmin's MIT-licensed SignInForm. See THIRD_PARTY_NOTICES.md.

/*
 * Sign-in (M13.8 06-personal-ui-spec.md): browser sign-in comes first:
 * GitHub/Google OAuth today, ORCID when it is enabled in Supabase Auth (the
 * active button set is read from /auth/v1/settings at runtime, so the page
 * never advertises a provider the backend would reject), plus passwordless
 * email. ORCID remains visible as a research-identity entry even before the
 * provider is configured, with its real setup state and the Settings handoff.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { GithubMark, GoogleMark, OrcidMark } from '@/components/brand-marks';
import { safeCallbackPath } from '@/lib/auth-session.mjs';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useAuth } from '@/components/auth-provider';
import { ORCID_PROVIDER, ORCID_PROVIDER_CONFIGURED, isOrcidProvider } from '@/lib/orcid-provider';

/* Known providers get their icon and display name; anything else the
 * backend enables still renders, generically; the button set follows the
 * live configuration instead of a hardcoded allowlist. */
const PROVIDER_ICONS = { github: GithubMark, orcid: OrcidMark, google: GoogleMark };
const HOME_PATH = '/home';
const PROVIDER_LABELS = { github: 'GitHub', orcid: 'ORCID', google: 'Google' };
const providerName = (provider) => (isOrcidProvider(provider) ? 'ORCID' : PROVIDER_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1));
const providerIcon = (provider) => (isOrcidProvider(provider) ? OrcidMark : PROVIDER_ICONS[provider] ?? null);
const providerRank = (provider) => (isOrcidProvider(provider) ? 0 : provider === 'github' ? 1 : provider === 'google' ? 2 : 3);

function authCallbackUrl() {
  const callback = new URL('/auth/callback', window.location.origin);
  const next = safeCallbackPath(new URLSearchParams(window.location.search).get('next'));
  if (next !== '/') callback.searchParams.set('next', next);
  return callback.toString();
}

export default function LoginPage() {
  const router = useRouter();
  const { session, ready } = useAuth();
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('magic');
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    if (ready && session) router.replace(HOME_PATH);
  }, [ready, session, router]);

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
        /* Email is rendered once by the dedicated form below; keeping it out
         * of this OAuth row avoids duplicate entry points. */
        const enabled = Object.keys(external).filter((provider) => provider.toLowerCase() !== 'email' && external[provider] === true);
        /* Custom OIDC providers are intentionally omitted by Supabase's
         * public settings payload. The production build flag is the
         * authoritative capability signal for EviMesh's custom ORCID row. */
        if (ORCID_PROVIDER_CONFIGURED && !enabled.some(isOrcidProvider)) enabled.unshift(ORCID_PROVIDER);
        setProviders(enabled);
      })
      .catch(() => { if (!cancelled) setProviders([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'expired') setMessage('Your previous session ended. Sign in again to continue.');
    if (reason === 'session') setMessage('The browser session was unavailable. Start a new sign-in to recover.');
  }, []);

  async function loginWithProvider(provider) {
    setPending(provider);
    setMessage(null);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signInWithOAuth({ provider, options: { redirectTo: authCallbackUrl() } });
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
    try {
      const auth = createBrowserSupabaseClient().auth;
      if (mode === 'magic') {
        const { error } = await auth.signInWithOtp({ email, options: { emailRedirectTo: authCallbackUrl() } });
        if (error) throw error;
        setMessage(`Sign-in link sent to ${email}. Open it on this device within an hour.`);
      } else if (mode === 'signup') {
        const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: authCallbackUrl() } });
        if (error) throw error;
        if (data?.session) {
          window.location.assign(authCallbackUrl());
          return;
        }
        setMessage(`Check ${email} for a confirmation link, then sign in.`);
        setMode('password');
      } else {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(authCallbackUrl());
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPending(null);
    }
  }

  const providerButtons = (providers ?? []).slice().sort((a, b) => providerRank(a) - providerRank(b))
    .map((provider) => ({ provider, label: providerName(provider), Icon: providerIcon(provider) }));
  const orcidConfigured = providerButtons.some(({ provider }) => isOrcidProvider(provider));

  const orcidIdentityState = providers === null || orcidConfigured ? null : (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-3 text-[13px]" aria-label="ORCID identity status">
      <OrcidMark size={16} />
      <span className="font-medium">ORCID research identity</span>
      <span className="text-muted-foreground">Not enabled in this workspace.</span>
      <Link className="text-primary hover:underline" href="/settings">Sign in with email, then connect ORCID</Link>
    </div>
  );

  if (!ready || session) return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p aria-live="polite" role="status">{session ? 'Opening your workspace…' : 'Checking session…'}</p>
    </main>
  );

  return (
    <main className="grid min-h-screen bg-background text-foreground">
      <section className="flex min-h-screen items-start justify-center px-5 pb-10 pt-[12vh] sm:px-8">
        <div className="w-full max-w-sm">
          <Link className="mb-8 inline-block text-[13px] text-muted-foreground hover:text-foreground hover:underline" href="/"><span className="text-foreground">Evi</span><span className="text-primary">Mesh</span></Link>
          <div className="mb-6 border-b border-border pb-3">
            <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.01em]">Sign in</h1>
          </div>

          {providers === null ? (
            <div className="h-10 w-full animate-pulse rounded-[2px] border border-border bg-muted" aria-label="Loading sign-in providers" />
          ) : providerButtons.length === 0 ? (
            /* No external provider is enabled: email only, plus the honest ORCID state. */
            <div className="mb-5">{orcidIdentityState}</div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2">
                {providerButtons.map(({ provider, label, Icon }) => (
                  <button
                    className="flex h-10 w-full items-center justify-center gap-2.5 rounded-[2px] border border-border bg-card text-sm font-medium transition-colors hover:border-foreground hover:bg-muted disabled:opacity-60"
                    disabled={pending !== null}
                    key={provider}
                    onClick={() => loginWithProvider(provider)}
                    type="button"
                  >
                    {Icon ? <Icon size={17} /> : null}
                    {pending === provider ? 'Redirecting…' : `Continue with ${label}`}
                  </button>
                ))}
              </div>
              {orcidIdentityState}
            </div>
          )}

          {providerButtons.length > 0 ? <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-border" /><span className="text-[13px] text-muted-foreground">or email</span><span className="h-px flex-1 bg-border" /></div> : null}

          <div className="mb-4 flex border-b border-border" role="tablist" aria-label="Email sign-in mode">
            {[['magic', 'Sign-in link'], ['password', 'Password'], ['signup', 'Create account']].map(([id, label]) => (
              <button
                aria-selected={mode === id}
                className={mode === id ? '-mb-px flex-1 border-b-2 border-foreground px-3 py-2 text-sm font-medium text-foreground' : '-mb-px flex-1 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground'}
                key={id}
                onClick={() => { setMode(id); setMessage(null); }}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={submitEmail}>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="email">Email</label>
              <input autoComplete="email" className="h-10 w-full rounded-[2px] border border-foreground/25 bg-card px-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-focus" id="email" name="email" placeholder="researcher@example.org" required type="email" />
            </div>
            {mode === 'magic' ? null : (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="password">{mode === 'signup' ? 'Choose a password' : 'Password'}</label>
                  {mode === 'password' ? <button className="text-xs font-medium text-primary hover:underline" onClick={() => setMode('magic')} type="button">Use a sign-in link instead</button> : null}
                </div>
                <div className="relative">
                  <input autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="h-10 w-full rounded-[2px] border border-foreground/25 bg-card px-4 pr-12 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-focus" id="password" name="password" placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'} required minLength={mode === 'signup' ? 6 : undefined} type={showPassword ? 'text' : 'password'} />
                  <button aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[2px] p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
              </div>
            )}
            <button className="flex h-10 w-full items-center justify-center rounded-[2px] bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={pending !== null} type="submit">
              {pending === 'email' ? 'Working…' : mode === 'magic' ? 'Email me a sign-in link' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {message ? <p aria-live="polite" className="mt-4 border-y border-border py-2.5 text-sm" role="alert">{message}</p> : null}

          {/* Registration stays one obvious step away, not a hidden tab. */}
          <p className="mt-4 text-sm text-muted-foreground">
            {mode === 'signup' ? 'Already have an account?' : 'New to EviMesh?'}
            <button className="ml-1 font-medium text-primary hover:underline" onClick={() => setMode(mode === 'signup' ? 'magic' : 'signup')} type="button">
              {mode === 'signup' ? 'Sign in instead' : 'Create an account'}
            </button>
          </p>
          <p className="mt-2 text-sm"><Link className="text-primary hover:underline" href="/agent">Connecting an Agent</Link></p>
        </div>
      </section>
    </main>
  );
}
