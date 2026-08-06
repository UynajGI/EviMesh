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
    <main className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-6 py-20">
      <section className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Connection interrupted</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-card-foreground">We could not complete that request.</h1>
        <p className="mt-4 leading-7 text-muted-foreground">Please try again. If this keeps happening, share the request ID with the EviMesh team so we can trace the failure.</p>
        {requestId && <p className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 font-mono text-sm text-card-foreground">request_id: {requestId}</p>}
        <Button className="mt-7" onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
