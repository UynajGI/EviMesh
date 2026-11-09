'use client';

import Link from 'next/link';
import { buttonLinkVariants } from '@/components/ui/button';
import { DeniedState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { useBrowserSession } from '@/components/session-shell-control';
import { cn } from '@/lib/utils';

function SignInLink({ returnTo }) {
  const href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  return <Link className={cn(buttonLinkVariants({ size: 'lg' }), 'min-h-11')} href={href}>Sign in</Link>;
}

/** Keep every account page honest about loading, anonymous, expired and failed sessions. */
export function AdmissionSessionBoundary({ children, returnTo = '/settings' }) {
  const auth = useBrowserSession();

  if (auth.status === 'loading') {
    return <div aria-busy="true" aria-label="Loading account session" className="mt-8 grid gap-3"><Skeleton className="h-11 w-full max-w-xl" /><Skeleton className="h-40 w-full" /></div>;
  }
  if (auth.status === 'expired') {
    return <DeniedState className="mt-8" title="Session expired" description="Sign in again before changing account or project access." scope="authenticated human session" action={<SignInLink returnTo={returnTo} />} />;
  }
  if (auth.status === 'anonymous') {
    return <DeniedState className="mt-8" title="Sign in required" description="Account and project access settings belong to your authenticated profile." scope="authenticated human session" action={<SignInLink returnTo={returnTo} />} />;
  }
  if (auth.status === 'error') {
    return <ErrorState className="mt-8" title="Session unavailable" message={auth.error} onRetry={() => window.location.reload()} />;
  }
  return children(auth.session);
}

/** Render authorization failures separately from session expiry and service errors. */
export function AdmissionFault({ error, onRetry, className = 'mt-6' }) {
  if (!error) return null;
  if (error.status === 401) {
    return <DeniedState className={className} title="Session expired" description={error.message} scope="authenticated human session" action={<SignInLink returnTo={typeof window === 'undefined' ? '/settings' : window.location.pathname} />} />;
  }
  if (error.status === 403) {
    return <DeniedState className={className} title="Permission needed" description={error.message} scope="project role or verified account" />;
  }
  if (error.status === 409) {
    return <ErrorState className={className} title="Already in progress" message={error.message} requestId={error.requestId} />;
  }
  if (error.status === 400 || error.status === 422) {
    return <ErrorState className={className} title="Check the details" message={error.message} requestId={error.requestId} />;
  }
  return <ErrorState className={className} message={error.message} requestId={error.requestId} onRetry={onRetry} />;
}
