'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';
import { apiFetch } from '@/lib/api-client';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const CLAIM_STATES = ['hypothesis', 'candidate', 'under_verification', 'provisionally_accepted', 'accepted', 'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted'];

/** Status badge variants: text labels first, color only reinforces meaning. */
function stateVariant(state) {
  switch (state) {
    case 'accepted': return 'success';
    case 'contested':
    case 'refuted':
    case 'retracted': return 'destructive';
    case 'under_verification':
    case 'dependency_tainted': return 'warning';
    case 'provisionally_accepted':
    case 'candidate': return 'info';
    default: return 'default';
  }
}

function claimState(claim) {
  return claim.status ?? claim.state ?? 'unknown';
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Activity time unavailable';
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
      setClaims(body.items ?? []);
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
    <div className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
      <div className="grid gap-2"><Label htmlFor="claim-status">Status</Label><Select id="claim-status" value={filters.status} onChange={updateFilter('status')}><option value="">All statuses</option>{CLAIM_STATES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="claim-tag">Tag</Label><Input id="claim-tag" value={filters.tag} onChange={updateFilter('tag')} placeholder="Filter by tag" /></div>
    </div>
  );

  if (error) {
    return <PageContainer><PageHeader eyebrow="Evidence graph" title="Claims" description="Browse research claims by protocol status and tag before opening their immutable revision history." /><ErrorState className="mt-8" message={error} requestId={requestId} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader eyebrow="Evidence graph" title="Claims" description="Browse research claims by protocol status and tag before opening their immutable revision history." />
      {loading ? <Skeleton className="mt-8 h-24 w-full" /> : filtersPanel}
      {loading ? <Skeleton className="mt-10 h-96 w-full" /> : claims.length === 0 ? <Empty className="mt-10" title="No claims match the current filters" description="Claims will appear here as research questions move through the protocol." /> : <div className="mt-10 grid gap-4 md:grid-cols-2">{claims.map((claim) => <Link className="rounded-lg border border-border bg-card p-5 transition hover:border-primary" href={`/claims/${claim.claimId}`} key={claim.claimId}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium tabular-nums">{claim.claimId}</h2><Badge variant={stateVariant(claimState(claim))}>{claimState(claim).replaceAll('_', ' ')}</Badge></div>{claim.tag && <span className="mt-3 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{claim.tag}</span>}<div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Question <span className="tabular-nums">{claim.questionId ?? 'not linked'}</span></p><time className="text-xs tabular-nums text-muted-foreground" dateTime={claim.createdAt}>{relativeTime(claim.createdAt)}</time></div></Link>)}</div>}
    </PageContainer>
  );
}
