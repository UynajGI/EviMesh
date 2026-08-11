'use client';

// Authentication layout adapted from TailAdmin's MIT-licensed SignInForm.
// See THIRD_PARTY_NOTICES.md.
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, GitFork, Network, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function loginWithEmail(event) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: form.get('email'), password: form.get('password') });
      if (error) throw error;
      window.location.assign('/');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPending(false);
    }
  }

  async function loginWithGitHub() {
    setPending(true);
    setMessage(null);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${window.location.origin}/` } });
      if (error) throw error;
    } catch (error) {
      setMessage(error.message);
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2 dark:bg-slate-950">
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white" href="/"><ArrowLeft aria-hidden="true" size={16} />Back to EviMesh</Link>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-[-0.035em] text-slate-900 dark:text-white">Login to your account</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Continue your research workspace, manage API tokens, and connect identities.</p>
          </div>

          <button className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800" disabled={pending} onClick={loginWithGitHub} type="button"><GitFork aria-hidden="true" size={19} />Continue with GitHub</button>

          <div className="my-7 flex items-center gap-4"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /><span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">or email</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /></div>

          <form className="space-y-5" onSubmit={loginWithEmail}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">Email</label>
              <input autoComplete="email" className="h-12 w-full rounded-lg border border-slate-300 bg-transparent px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 dark:border-slate-700 dark:text-white" id="email" name="email" placeholder="researcher@example.org" required type="email" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">Password</label><a className="text-xs font-medium text-blue-600 hover:text-blue-700" href="mailto:support@evimesh.com?subject=EviMesh%20account%20recovery">Forgot password?</a></div>
              <div className="relative">
                <input autoComplete="current-password" className="h-12 w-full rounded-lg border border-slate-300 bg-transparent px-4 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 dark:border-slate-700 dark:text-white" id="password" name="password" placeholder="Enter your password" required type={showPassword ? 'text' : 'password'} />
                <button aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
            <button className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">{pending ? 'Logging in…' : 'Login'}</button>
          </form>

          {message ? <p aria-live="polite" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300" role="alert">{message}</p> : null}

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600" size={18} /><p className="text-xs leading-5 text-slate-500"><strong className="text-slate-700 dark:text-slate-300">Research identity is separate from login.</strong> GitHub authenticates your account; ORCID will be connected and verified from your profile rather than treated as proof by typing an identifier.</p></div>
          </div>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">Credentials are handled by Supabase Auth. EviMesh never stores your password or GitHub token.</p>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.15)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative max-w-lg px-14 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20"><Network aria-hidden="true" size={32} /></span>
          <h2 className="mt-8 text-3xl font-bold tracking-[-0.04em] text-white">Research records you can inspect, trace, and challenge.</h2>
          <p className="mt-5 leading-7 text-slate-400">Move between scientific questions, claim revisions, evidence relationships, verification findings, and the current frontier without losing provenance.</p>
          <Link className="mt-8 inline-flex items-center text-sm font-semibold text-blue-300 hover:text-blue-200" href="/agent">Prefer an Agent? Open the CLI & MCP manual →</Link>
        </div>
      </aside>
    </main>
  );
}
