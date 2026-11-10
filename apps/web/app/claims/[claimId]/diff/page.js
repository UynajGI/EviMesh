'use client';

import { useEffect, useState } from 'react';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { Breadcrumb, PageContainer, PageHeader } from '@/components/ui/page';
import { ActorName, formatDate } from '@/components/ui/doc';
import { apiFetch } from '@/lib/api-client';

async function loadRevision(claimId, revision) {
  const body = await apiFetch(`/claims/${claimId}/revisions/${revision}`);
  return body.claimRevision;
}

function FieldValue({ value, className }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
  return <pre className={`whitespace-pre-wrap break-words font-mono text-xs leading-6 ${className ?? ''}`}>{text}</pre>;
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

  const trail = [
    { label: 'Explore', href: '/explore' },
    { label: 'Claim', href: claimId ? `/claims/${claimId}` : '/claims' },
    { label: 'Compare revisions' },
  ];

  return (
    <PageContainer>
      <Breadcrumb trail={trail} />
      <PageHeader title="Compare revisions" />
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <div className="flex items-center gap-2"><Label className="font-normal text-muted-foreground" htmlFor="from-revision">From revision</Label><Input aria-label="From revision" className="h-8 w-20" id="from-revision" min="1" onChange={(event) => setFromRevision(event.target.value)} type="number" value={fromRevision} /></div>
        <div className="flex items-center gap-2"><Label className="font-normal text-muted-foreground" htmlFor="to-revision">To revision</Label><Input aria-label="To revision" className="h-8 w-20" id="to-revision" min="1" onChange={(event) => setToRevision(event.target.value)} type="number" value={toRevision} /></div>
      </div>
      {error ? <ErrorState className="mt-6" message={error} onRetry={() => setRetryKey((value) => value + 1)} /> : loading ? <Skeleton className="mt-6 h-96 w-full" /> : diff && (
        <section aria-label="Revision field differences" className="mt-6">
          <div className="grid gap-x-6 border-b border-border pb-1.5 text-[13px] text-muted-foreground md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]">
            <p>Changed fields <span className="tabular-nums text-foreground">{diff.fields.length}</span></p>
            <p className="flex flex-wrap items-baseline gap-x-1.5"><span className="font-mono text-foreground">r{fromRevision}</span>{diff.from.createdBy ? <>by <ActorName actorId={diff.from.createdBy} showOwner={false} /></> : null}{diff.from.createdAt ? <span className="tabular-nums">{formatDate(diff.from.createdAt)}</span> : null}</p>
            <p className="flex flex-wrap items-baseline gap-x-1.5"><span className="font-mono text-foreground">r{toRevision}</span>{diff.to.createdBy ? <>by <ActorName actorId={diff.to.createdBy} showOwner={false} /></> : null}{diff.to.createdAt ? <span className="tabular-nums">{formatDate(diff.to.createdAt)}</span> : null}</p>
          </div>
          {diff.fields.length === 0 ? <p className="clause__none mt-3">No differences.</p> : (
            <dl>
              {diff.fields.map((field) => (
                <div className="grid gap-x-6 gap-y-1 border-b border-border py-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]" key={field}>
                  <dt className="text-sm text-muted-foreground">{field}</dt>
                  <dd className="min-w-0"><FieldValue className="text-muted-foreground line-through decoration-1" value={diff.from[field]} /></dd>
                  <dd className="min-w-0 change-bar ml-3 md:ml-0"><FieldValue value={diff.to[field]} /></dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </PageContainer>
  );
}
