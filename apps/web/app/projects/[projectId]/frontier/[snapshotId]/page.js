'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

function memberMap(snapshot) {
  return new Map((snapshot?.members ?? []).map((member) => [member.claimId, member]));
}

export default function FrontierDetailPage({ params }) {
  const [route, setRoute] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(setRoute); }, [params]);
  useEffect(() => {
    if (!route?.projectId) return;
    fetch(`${API}/projects/${route.projectId}/frontier/history?limit=100`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Frontier history is unavailable.');
      setHistory(payload.items ?? []);
    }).catch((reason) => setError(reason.message));
  }, [route]);
  if (error) return <main className="mx-auto max-w-5xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  if (!route || !history.length) return <main className="mx-auto max-w-5xl px-6 py-16" aria-busy="true">Loading Frontier…</main>;
  const snapshot = history.find((item) => item.snapshotId === route.snapshotId);
  if (!snapshot) return <main className="mx-auto max-w-5xl px-6 py-16"><p role="alert" className="text-sm text-destructive">Frontier snapshot not found.</p></main>;
  const previous = history.filter((item) => item.sequence < snapshot.sequence).sort((left, right) => right.sequence - left.sequence)[0];
  const current = memberMap(snapshot); const prior = memberMap(previous);
  const added = [...current.keys()].filter((claimId) => !prior.has(claimId));
  const removed = [...prior.keys()].filter((claimId) => !current.has(claimId));
  const changed = [...current.keys()].filter((claimId) => prior.has(claimId) && JSON.stringify(current.get(claimId)) !== JSON.stringify(prior.get(claimId)));
  return <main className="mx-auto max-w-5xl px-6 py-16"><Link className="text-sm text-primary hover:underline" href={`/projects/${route.projectId}`}>← Back to project</Link><p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">Immutable Frontier</p><h1 className="mt-3 font-mono text-3xl font-semibold">{snapshot.snapshotId}</h1><div className="mt-8 grid gap-4 sm:grid-cols-4"><section className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Sequence</p><p className="mt-2 text-2xl font-semibold">{snapshot.sequence}</p></section><section className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Members</p><p className="mt-2 text-2xl font-semibold">{snapshot.members?.length ?? 0}</p></section><section className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Policy</p><p className="mt-2 text-sm">{snapshot.policy ?? snapshot.policyId ?? 'Not specified'}</p></section><section className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Checkpoint</p><p className="mt-2 break-all font-mono text-xs">{snapshot.checkpointId ?? snapshot.checkpoint?.checkpointId ?? 'Not attached'}</p></section></div><section className="mt-8 rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Member diff</h2><p className="mt-2 text-sm text-muted-foreground">Compared with the previous Frontier snapshot.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><p className="rounded bg-emerald-50 p-3 text-sm">Added: {added.length}</p><p className="rounded bg-red-50 p-3 text-sm">Removed: {removed.length}</p><p className="rounded bg-amber-50 p-3 text-sm">Changed: {changed.length}</p></div></section><section className="mt-8 rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Members</h2>{snapshot.members?.length ? <ul className="mt-4 space-y-2">{snapshot.members.map((member) => <li className="rounded border border-border p-3 font-mono text-sm" key={`${member.claimId}@${member.claimRevision}`}>{member.claimId}@{member.claimRevision} · {member.membershipType ?? member.status ?? 'member'}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No members.</p>}</section></main>;
}
