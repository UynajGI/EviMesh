'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClaimDag } from '@/components/claim-dag';

async function request(path) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Claim data is unavailable.');
  return payload;
}

function JsonBlock({ value }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify(value ?? [], null, 2)}</pre>;
}

export default function ClaimDetailPage({ params }) {
  const [claimId, setClaimId] = useState(null);
  const [data, setData] = useState(null);
  const [graph, setGraph] = useState(null);
  const [direction, setDirection] = useState('downstream');
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ claimId: value }) => setClaimId(value)); }, [params]);
  useEffect(() => { if (claimId) request(`/claims/${claimId}`).then(setData).catch((reason) => setError(reason.message)); }, [claimId]);
  useEffect(() => { if (claimId) request(`/claims/${claimId}/graph?direction=${direction}&maxDepth=3`).then(setGraph).catch((reason) => setError(reason.message)); }, [claimId, direction]);
  if (error) return <main className="mx-auto max-w-5xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-5xl px-6 py-16" aria-busy="true">Loading claim…</main>;
  const { claim, currentRevision, statusPolicy } = data;
  const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const nodeIds = graphNodes.map((node) => node.claimId ?? node.id).filter((id) => typeof id === 'string' && id !== claim.claimId);
  const dagElements = [{ data: { id: claim.claimId, label: claim.claimId } }, ...nodeIds.map((id) => ({ data: { id, label: id } })), ...nodeIds.map((id) => ({ data: { id: `${direction}-${id}`, source: direction === 'upstream' ? id : claim.claimId, target: direction === 'upstream' ? claim.claimId : id } }))];
  return <main className="mx-auto max-w-5xl px-6 py-16"><Link className="text-sm text-primary hover:underline" href="/claims">← Back to Claims</Link><p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">{claim.state}</p><h1 className="mt-3 text-4xl font-semibold">Claim {claim.claimId}</h1><p className="mt-4 max-w-3xl text-lg">{currentRevision.statement}</p><div className="mt-8 grid gap-4 sm:grid-cols-3"><section className="rounded-lg border border-border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Current revision</p><p className="mt-2 text-2xl font-semibold">#{currentRevision.revision}</p></section><section className="rounded-lg border border-border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Question</p><p className="mt-2 font-mono text-sm">{claim.questionId ?? 'Not linked'}</p></section><section className="rounded-lg border border-border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Next allowed states</p><p className="mt-2 text-sm">{statusPolicy.allowedTransitions.join(', ') || 'No transitions'}</p></section></div><section className="mt-10"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Claim dependency graph</h2><div className="flex gap-2"><button className="rounded border border-border px-3 py-1 text-sm" type="button" onClick={() => setDirection('upstream')}>Upstream</button><button className="rounded border border-border px-3 py-1 text-sm" type="button" onClick={() => setDirection('downstream')}>Downstream</button></div></div><ClaimDag elements={dagElements} /></section><section className="mt-10 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Scope</h2><JsonBlock value={currentRevision.scope} /></section><section className="mt-6 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Falsification conditions</h2><JsonBlock value={currentRevision.falsification ?? currentRevision.falsificationConditions} /></section><section className="mt-6 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Assumptions</h2><JsonBlock value={currentRevision.assumptions} /></section><section className="mt-6 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Revision history</h2><div className="mt-3 rounded border border-border p-4"><p className="font-mono text-sm">Revision {currentRevision.revision}</p><p className="mt-2 text-sm text-muted-foreground">Current immutable revision; previous revisions are linked by `supersedes`.</p>{currentRevision.supersedes && <p className="mt-2 text-xs text-muted-foreground">Supersedes revision {currentRevision.supersedes}.</p>}</div></section></main>;
}
