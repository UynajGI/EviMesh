'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function requestIdFrom(error) {
  const candidate = error?.request_id ?? error?.requestId ?? error?.cause?.request_id ?? error?.cause?.requestId;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

export default function GlobalError({ error, reset }) {
  const requestId = requestIdFrom(error);

  useEffect(() => {
    console.error('EviMesh route error', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[84rem] items-center px-[var(--evimesh-container-px)] py-20">
      <section aria-labelledby="route-error-heading" className="w-full max-w-2xl border-t border-foreground pt-4">
        <h1 className="text-[clamp(1.625rem,2.6vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em]" id="route-error-heading">We could not complete that request.</h1>
        <p className="mt-3 max-w-[60ch] leading-7 text-muted-foreground">The connection was interrupted. Please try again. If this keeps happening, share the request ID with the EviMesh team so we can trace the failure.</p>
        {requestId && <p className="mt-5 border-y border-border py-3 font-mono text-sm text-foreground">request_id: {requestId}</p>}
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
