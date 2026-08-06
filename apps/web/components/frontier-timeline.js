'use client';

import { useEffect, useState } from 'react';
import { ClaimDag } from '@/components/claim-dag';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

export function FrontierTimeline({ projectId }) {
  const [history, setHistory] = useState([]);
  const [snapshotId, setSnapshotId] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!projectId) return;
    fetch(`${API}/projects/${projectId}/frontier/history?limit=100`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Frontier history is unavailable.');
      const items = body.items ?? [];
      setHistory(items);
      setSnapshotId(items[items.length - 1]?.snapshotId ?? '');
    }).catch((reason) => setError(reason.message));
  }, [projectId]);
  const snapshot = history.find((item) => item.snapshotId === snapshotId) ?? null;
  const members = Array.isArray(snapshot?.members) ? snapshot.members : [];
  const elements = members.map((member) => ({ data: { id: member.claimId, label: member.claimId, state: member.status } }));
  if (error) return <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>;
  return <section className="mt-12 rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Frontier time travel</h2><p className="mt-2 text-sm text-muted-foreground">Select an immutable Frontier to redraw its fixed Claim members.</p></div><label className="grid gap-2 text-sm font-medium">Frontier<select aria-label="Frontier snapshot" className="rounded border border-input bg-background px-3 py-2 font-normal" value={snapshotId} onChange={(event) => setSnapshotId(event.target.value)}><option value="">Select a Frontier</option>{history.map((item) => <option key={item.snapshotId} value={item.snapshotId}>#{item.sequence} · {item.snapshotId}</option>)}</select></label></div>{snapshot ? <div className="mt-5"><p className="mb-3 text-sm text-muted-foreground">{members.length} fixed members · sequence {snapshot.sequence}</p><ClaimDag elements={elements} /></div> : <p className="mt-5 text-sm text-muted-foreground">No Frontier history is available.</p>}</section>;
}
