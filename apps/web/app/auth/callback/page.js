'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EviMeshMark } from '@/components/brand-marks';
import { ErrorState } from '@/components/ui/feedback';
import {
  bootstrapActorForSession,
  callbackErrorMessage,
  markAuthenticatedSession,
  safeCallbackPath,
} from '@/lib/auth-session.mjs';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('Restoring your secure session…');
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function completeAuthentication() {
      setFailure(null);
      setPhase('Restoring your secure session…');
      try {
        const providerError = callbackErrorMessage(window.location);
        if (providerError) {
          const error = new Error(providerError);
          error.code = 'AUTH_CALLBACK_REJECTED';
          throw error;
        }

        const { data, error } = await createBrowserSupabaseClient().auth.getSession();
        if (error) throw error;
        if (!data.session) {
          const missing = new Error('No authenticated session was returned. The link may have expired; sign in again.');
          missing.code = 'AUTH_CALLBACK_SESSION_MISSING';
          throw missing;
        }

        if (!cancelled) setPhase('Setting up your research identity…');
        await bootstrapActorForSession(data.session);
        markAuthenticatedSession(window.localStorage);

        if (!cancelled) {
          const next = safeCallbackPath(new URLSearchParams(window.location.search).get('next'));
          router.replace(next);
        }
      } catch (error) {
        if (!cancelled) {
          setFailure({
            message: error.message ?? 'EviMesh could not complete sign-in.',
            requestId: error.requestId ?? null,
          });
        }
      }
    }

    completeAuthentication();
    return () => { cancelled = true; };
  }, [attempt, router]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-xl">
        <Link className="flex w-fit items-center gap-2 text-[0.9375rem] font-semibold" href="/">
          <EviMeshMark className="size-6" />
          <span><span className="text-foreground">Evi</span><span className="text-primary">Mesh</span></span>
        </Link>

        {failure ? (
          <>
            <ErrorState
              className="mt-6"
              message={failure.message}
              onRetry={() => setAttempt((value) => value + 1)}
              requestId={failure.requestId}
              retryLabel="Retry account setup"
              title="Sign-in could not be completed"
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Link expired? <Link className="text-primary hover:underline" href="/login">Start a new sign-in</Link>.
            </p>
          </>
        ) : (
          <section aria-busy="true" aria-live="polite" className="mt-6 border-b border-border pb-3">
            <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.01em]">Completing sign-in</h1>
            <p className="mt-1 text-sm text-muted-foreground">{phase}</p>
          </section>
        )}
      </div>
    </main>
  );
}
