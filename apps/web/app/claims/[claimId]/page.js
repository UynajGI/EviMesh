'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClaimDag } from '@/components/claim-dag';
import { Badge } from '@/components/ui/data';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Claim data is unavailable.');
  return payload;
}

function JsonBlock({ value }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify(value ?? [], null, 2)}</pre>;
}

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

export default function ClaimDetailPage({ params }) {
  const [claimId, setClaimId] = useState(null);
  const [data, setData] = useState(null);
  const [graph, setGraph] = useState(null);
  const [direction, setDirection] = useState('downstream');
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ claimId: value }) => setClaimId(value)); }, [params]);
  async function load() {
    setError(null);
    try { setData(await request(`/claims/${claimId}`)); } catch (reason) { setError(reason.message); }
  }
  useEffect(() => { if (claimId) load(); }, [claimId]);
  useEffect(() => { if (claimId) request(`/claims/${claimId}/graph?direction=${direction}&maxDepth=3`).then(setGraph).catch((reason) => setError(reason.message)); }, [claimId, direction]);
  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;
  const { claim, currentRevision, statusPolicy } = data;
  const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const graphEntries = graphNodes.map((node) => ({ id: node.claimId ?? node.id, state: node.state ?? node.status })).filter((node) => typeof node.id === 'string' && node.id !== claim.claimId);
  const dagElements = [{ data: { id: claim.claimId, label: claim.claimId, state: claim.state } }, ...graphEntries.map(({ id, state }) => ({ data: { id, label: id, state } })), ...graphEntries.map(({ id }) => ({ data: { id: `${direction}-${id}`, source: direction === 'upstream' ? id : claim.claimId, target: direction === 'upstream' ? claim.claimId : id } }))];
  const stats = [
    { label: 'Current revision', value: `#${currentRevision.revision}` },
    { label: 'Question', value: claim.questionId ?? 'Not linked' },
    { label: 'Next allowed states', value: statusPolicy.allowedTransitions.join(', ') || 'No transitions' },
  ];
  return <PageContainer><Link className="text-sm font-medium text-primary hover:underline" href="/claims">← Back to Claims</Link><PageHeader eyebrow="Claim" title={`Claim ${claim.claimId}`} description={currentRevision.statement} action={<Badge variant={stateVariant(claim.state)}>{claim.state.replaceAll('_', ' ')}</Badge>} />
    <div className="mt-10 grid gap-4 sm:grid-cols-3">{stats.map((stat) => <div className="rounded-lg border border-border bg-card p-4" key={stat.label}><p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p><p className="mt-2 font-medium tabular-nums">{stat.value}</p></div>)}</div>
    <section className="mt-10" aria-labelledby="graph-heading"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="graph-heading" className="text-lg font-semibold">Claim dependency graph</h2><div className="flex gap-2"><button className="rounded-md border border-border px-3 py-1.5 text-sm" type="button" onClick={() => setDirection('upstream')}>Upstream</button><button className="rounded-md border border-border px-3 py-1.5 text-sm" type="button" onClick={() => setDirection('downstream')}>Downstream</button></div></div><ClaimDag elements={dagElements} /></section>
    <section className="mt-10" aria-labelledby="scope-heading"><h2 id="scope-heading" className="text-lg font-semibold">Scope</h2><JsonBlock value={currentRevision.scope} /></section>
    <section className="mt-6" aria-labelledby="falsification-heading"><h2 id="falsification-heading" className="text-lg font-semibold">Falsification conditions</h2><JsonBlock value={currentRevision.falsification ?? currentRevision.falsificationConditions} /></section>
    <section className="mt-6" aria-labelledby="assumptions-heading"><h2 id="assumptions-heading" className="text-lg font-semibold">Assumptions</h2><JsonBlock value={currentRevision.assumptions} /></section>
    <section className="mt-6" aria-labelledby="revisions-heading"><h2 id="revisions-heading" className="text-lg font-semibold">Revision history</h2><div className="mt-3 rounded-lg border border-border bg-card p-4"><p className="font-mono text-sm tabular-nums">Revision {currentRevision.revision}</p><p className="mt-2 text-sm text-muted-foreground">Current immutable revision; previous revisions are linked by `supersedes`.</p>{currentRevision.supersedes && <p className="mt-2 text-xs text-muted-foreground">Supersedes revision {currentRevision.supersedes}.</p>}</div></section>
  </PageContainer>;
}
