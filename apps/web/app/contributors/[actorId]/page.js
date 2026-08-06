'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

export default function ContributorDetailPage({ params }) {
  const [actorId, setActorId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ actorId: value }) => setActorId(value)); }, [params]);
  useEffect(() => {
    if (!actorId) return;
    fetch(`${API}/actors/${actorId}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Contributor is unavailable.');
      setData(payload);
    }).catch((reason) => setError(reason.message));
  }, [actorId]);
  if (error) return <main className="mx-auto max-w-5xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-5xl px-6 py-16" aria-busy="true">Loading contributor…</main>;
  const actor = data.actor ?? data.profile ?? data;
  const list = (value) => Array.isArray(value) ? value : [];
  return <main className="mx-auto max-w-5xl px-6 py-16"><Link className="text-sm text-primary hover:underline" href="/contributions">← Contributions</Link><p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">Contributor</p><h1 className="mt-3 font-mono text-3xl font-semibold">{actor.actorId ?? actorId}</h1><p className="mt-3 text-muted-foreground">{actor.displayName ?? actor.handle ?? 'EviMesh contributor'}</p><div className="mt-8 grid gap-4 md:grid-cols-2"><section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Roles</h2><ul className="mt-4 space-y-2">{list(data.roles ?? actor.roles).map((role) => <li className="rounded border border-border p-3 text-sm" key={typeof role === 'string' ? role : role.role}>{typeof role === 'string' ? role : JSON.stringify(role)}</li>)}</ul></section><section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Frontier usage</h2><pre className="mt-4 overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data.frontierUsage ?? data.frontiers ?? [], null, 2)}</pre></section><section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Produced</h2><pre className="mt-4 overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data.produced ?? actor.produced ?? [], null, 2)}</pre></section><section className="rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Used</h2><pre className="mt-4 overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data.used ?? actor.used ?? [], null, 2)}</pre></section></div></main>;
}
