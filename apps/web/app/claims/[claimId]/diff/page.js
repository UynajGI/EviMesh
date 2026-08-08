'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { apiFetch } from '@/lib/api-client';

async function loadRevision(claimId, revision) {
  const body = await apiFetch(`/claims/${claimId}/revisions/${revision}`);
  return body.claimRevision;
}

export default function ClaimRevisionDiffPage({ params }) {
  const [claimId, setClaimId] = useState(null);
  const [fromRevision, setFromRevision] = useState('1');
  const [toRevision, setToRevision] = useState('2');
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => { Promise.resolve(params).then(({ claimId: value }) => setClaimId(value)); }, [params]);

  useEffect(() => {
    if (!claimId) return;
    let active = true;
    setLoading(true);
    Promise.all([loadRevision(claimId, Number(fromRevision)), loadRevision(claimId, Number(toRevision))]).then(([from, to]) => {
      if (!active) return;
      const fields = [...new Set([...Object.keys(from), ...Object.keys(to)])].filter((field) => field !== 'createdAt');
      setDiff({ from, to, fields: fields.filter((field) => JSON.stringify(from[field]) !== JSON.stringify(to[field])) });
      setError(null);
    }).catch((reason) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [claimId, fromRevision, toRevision, retryKey]);

  if (error) return <PageContainer><PageHeader eyebrow="Claims" title="Claim revision diff" description="Compare immutable claim revisions field by field." /><ErrorState className="mt-8" message={error} onRetry={() => setRetryKey((value) => value + 1)} /></PageContainer>;

  return <PageContainer><Link className="text-sm font-medium text-primary hover:underline" href={claimId ? `/claims/${claimId}` : '/claims'}>← Back to Claim</Link><PageHeader eyebrow="Claims" title="Claim revision diff" description="Compare immutable claim revisions field by field." />
    <div className="mt-8 flex flex-wrap items-end gap-4">
      <div className="grid gap-2"><Label htmlFor="from-revision">From revision</Label><Input id="from-revision" aria-label="From revision" className="w-32" min="1" type="number" value={fromRevision} onChange={(event) => setFromRevision(event.target.value)} /></div>
      <div className="grid gap-2"><Label htmlFor="to-revision">To revision</Label><Input id="to-revision" aria-label="To revision" className="w-32" min="1" type="number" value={toRevision} onChange={(event) => setToRevision(event.target.value)} /></div>
    </div>
    {loading ? <Skeleton className="mt-8 h-96 w-full" /> : diff && <section aria-label="Revision field differences" className="mt-8 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Changed fields: {diff.fields.length}</p><div className="flex flex-wrap gap-2">{diff.from.createdBy ? <Badge variant="info">by {diff.from.createdBy}</Badge> : null}{diff.from.createdAt ? <span className="text-xs tabular-nums text-muted-foreground">from {diff.from.createdAt}</span> : null}{diff.to.createdBy ? <Badge variant="info">to {diff.to.createdBy}</Badge> : null}</div></div>
      {diff.fields.length === 0 ? <p className="mt-4 text-sm">No differences.</p> : <div className="mt-4 space-y-4">{diff.fields.map((field) => <div className="grid gap-3 border-t border-border pt-4 md:grid-cols-2" key={field}><div><p className="font-mono text-sm">{field}</p><pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-6">{JSON.stringify(diff.from[field], null, 2)}</pre></div><pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-6">{JSON.stringify(diff.to[field], null, 2)}</pre></div>)}</div>}
    </section>}
  </PageContainer>;
}
