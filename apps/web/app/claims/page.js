'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/data';
import { Identifier, shortId } from '@/components/ui/doc';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';
import { apiFetch } from '@/lib/api-client';
import { withWords } from '@/lib/list-words.mjs';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const CLAIM_STATES = ['hypothesis', 'candidate', 'under_verification', 'provisionally_accepted', 'accepted', 'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted'];

function claimState(claim) {
  return claim.status ?? claim.state ?? 'unknown';
}

/* The statement comes from the row, or from the bounded detail read in withWords. */
function claimStatement(claim) {
  const value = claim.statement ?? claim.currentRevision?.statement ?? claim.words ?? null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [filters, setFilters] = useState({ status: '', tag: '' });

  async function load() {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const query = new URLSearchParams({ limit: '100' });
      for (const key of ['status', 'tag']) if (filters[key]) query.set(key, filters[key]);
      const body = await apiFetch(`/claims?${query.toString()}`);
      setClaims(await withWords(API, body.items ?? [], { idKey: 'claimId', path: '/claims', record: 'claim', fields: ['statement'] }));
    } catch (reason) {
      setError(reason.message);
      setRequestId(reason.requestId ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filters]);

  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));

  const filtersPanel = (
    <div className="mt-4 grid gap-4 border-b border-border pb-4 sm:grid-cols-2">
      <div className="grid gap-2"><Label htmlFor="claim-status">Status</Label><Select id="claim-status" value={filters.status} onChange={updateFilter('status')}><option value="">All statuses</option>{CLAIM_STATES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="claim-tag">Tag</Label><Input id="claim-tag" value={filters.tag} onChange={updateFilter('tag')} placeholder="Filter by tag" /></div>
    </div>
  );

  if (error) {
    return <PageContainer><PageHeader title="Claims" /><ErrorState className="mt-8" message={error} requestId={requestId} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader title="Claims" />
      {loading ? <Skeleton className="mt-4 h-16 w-full" /> : filtersPanel}
      {loading ? <Skeleton className="mt-8 h-96 w-full" /> : claims.length === 0 ? <Empty className="mt-8" title={filters.status || filters.tag ? 'No matching claims' : 'No claims yet'} /> : (
        <section aria-labelledby="claims-heading" className="mt-8">
          <SectionHeader action={<span className="tabular-nums text-muted-foreground">{claims.length}</span>} id="claims-heading" title="Research claims" />
          <ul>
            {claims.map((claim) => {
              const statement = claimStatement(claim);
              return (
                <li className="ref-row" key={claim.claimId}>
                  <div><StatusBadge label={claimState(claim).replaceAll('_', ' ')} state={claimState(claim)} /></div>
                  <div className="min-w-0">
                    {statement ? (
                      <Link className="ref-row__title [overflow-wrap:anywhere] hover:underline" href={`/claims/${claim.claimId}`}>{statement}</Link>
                    ) : (
                      <Link className="block font-mono text-sm tabular-nums hover:underline" href={`/claims/${claim.claimId}`} title={claim.claimId}>{shortId(claim.claimId)}</Link>
                    )}
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {statement ? <Identifier value={claim.claimId} /> : null}
                      {claim.questionId ? <Link className="hover:text-foreground hover:underline" href={`/questions/${claim.questionId}`} title={claim.questionId}><span className="font-mono tabular-nums">{shortId(claim.questionId)}</span></Link> : null}
                      {claim.tag ? <span>Tag {claim.tag}</span> : null}
                    </p>
                  </div>
                  <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={claim.createdAt} title={claim.createdAt}>{relativeTime(claim.createdAt)}</time>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
