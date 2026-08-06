'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function loadRevision(claimId, revision) {
  const response = await fetch(`${API}/claims/${claimId}/revisions/${revision}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Revision is unavailable.');
  return payload.claimRevision;
}

export default function ClaimRevisionDiffPage({ params }) {
  const [claimId, setClaimId] = useState(null);
  const [fromRevision, setFromRevision] = useState('1');
  const [toRevision, setToRevision] = useState('2');
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ claimId: value }) => setClaimId(value)); }, [params]);
  useEffect(() => {
    if (!claimId) return;
    Promise.all([loadRevision(claimId, Number(fromRevision)), loadRevision(claimId, Number(toRevision))]).then(([from, to]) => {
      const fields = [...new Set([...Object.keys(from), ...Object.keys(to)])].filter((field) => field !== 'createdAt');
      setDiff({ from, to, fields: fields.filter((field) => JSON.stringify(from[field]) !== JSON.stringify(to[field])) });
      setError(null);
    }).catch((reason) => setError(reason.message));
  }, [claimId, fromRevision, toRevision]);
  return <main className="mx-auto max-w-5xl px-6 py-16"><Link className="text-sm text-primary hover:underline" href={claimId ? `/claims/${claimId}` : '/claims'}>← Back to Claim</Link><h1 className="mt-10 text-4xl font-semibold">Claim revision diff</h1><div className="mt-8 flex flex-wrap gap-4"><label className="grid gap-2 text-sm font-medium">From revision<input aria-label="From revision" className="w-32 rounded border border-input bg-background px-3 py-2" min="1" type="number" value={fromRevision} onChange={(event) => setFromRevision(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">To revision<input aria-label="To revision" className="w-32 rounded border border-input bg-background px-3 py-2" min="1" type="number" value={toRevision} onChange={(event) => setToRevision(event.target.value)} /></label></div>{error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}{diff && <section aria-label="Revision field differences" className="mt-8 rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Changed fields: {diff.fields.length}</p>{diff.fields.length === 0 ? <p className="mt-4 text-sm">No differences.</p> : <div className="mt-4 space-y-4">{diff.fields.map((field) => <div className="grid gap-3 border-t border-border pt-4 md:grid-cols-2" key={field}><div><p className="font-mono text-sm">{field}</p><pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-3 text-xs">{JSON.stringify(diff.from[field], null, 2)}</pre></div><pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{JSON.stringify(diff.to[field], null, 2)}</pre></div>)}</div>}</section>}</main>;
}
