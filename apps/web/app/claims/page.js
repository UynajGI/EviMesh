'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const CLAIM_STATES = ['hypothesis', 'candidate', 'under_verification', 'provisionally_accepted', 'accepted', 'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted'];

export default function ClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [filters, setFilters] = useState({ status: '', tag: '' });
  const [error, setError] = useState(null);
  useEffect(() => {
    const query = new URLSearchParams({ limit: '100' });
    if (filters.status) query.set('status', filters.status);
    if (filters.tag) query.set('tag', filters.tag);
    fetch(`${API}/claims?${query.toString()}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Claims are unavailable.');
      setClaims(body.items ?? []);
    }).catch((reason) => setError(reason.message));
  }, [filters]);
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  if (error) return <main className="mx-auto max-w-6xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  return <main className="mx-auto max-w-6xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Evidence graph</p><h1 className="mt-3 text-5xl font-semibold tracking-tight">Claims</h1><p className="mt-4 max-w-2xl text-muted-foreground">Browse research claims by protocol status and tag before opening their immutable revision history.</p><div className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Status<select className="rounded-md border border-input bg-background px-3 py-2 font-normal" value={filters.status} onChange={update('status')}><option value="">All statuses</option>{CLAIM_STATES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Tag<input className="rounded-md border border-input bg-background px-3 py-2 font-normal" value={filters.tag} onChange={update('tag')} placeholder="Filter by tag" /></label></div><section className="mt-10 grid gap-4 md:grid-cols-2">{claims.map((claim) => <Link className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary" href={`/claims/${claim.claimId}`} key={claim.claimId}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-mono text-sm">{claim.claimId}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize">{(claim.status ?? claim.state ?? 'unknown').replaceAll('_', ' ')}</span></div>{claim.tag && <span className="mt-4 inline-block rounded-full bg-muted px-2 py-1 text-xs">{claim.tag}</span>}<p className="mt-4 text-sm text-muted-foreground">Open claim details</p></Link>)}{claims.length === 0 && !error && <p className="text-sm text-muted-foreground">No claims match the current filters.</p>}</section></main>;
}
