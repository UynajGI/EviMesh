'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { apiFetch } from '@/lib/api-client';

function actorLabel(actorId) {
  return actorId ?? 'Unknown contributor';
}

export default function ContributionsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const body = await apiFetch('/events?limit=100');
      setEvents(body.items ?? []);
    } catch (reason) {
      setError(reason.message);
      setRequestId(reason.requestId ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (error) {
    return <PageContainer><PageHeader eyebrow="Shared credit" title="Contributions" description="See the people and roles behind each verified step of scientific progress." /><ErrorState className="mt-8" message={error} requestId={requestId} onRetry={load} /></PageContainer>;
  }

  const byActor = new Map();
  for (const event of events) {
    const actor = actorLabel(event.actorId);
    if (!byActor.has(actor)) byActor.set(actor, { actor, count: 0, types: new Set(), latest: event.createdAt });
    const entry = byActor.get(actor);
    entry.count += 1;
    if (event.eventType) entry.types.add(event.eventType);
    if (event.createdAt && (!entry.latest || event.createdAt > entry.latest)) entry.latest = event.createdAt;
  }
  const contributors = [...byActor.values()].sort((left, right) => right.count - left.count);

  return <PageContainer wide><PageHeader eyebrow="Shared credit" title="Contributions" description="See the people and roles behind each verified step of scientific progress." />
    {loading ? <Skeleton className="mt-10 h-96 w-full" /> : contributors.length === 0 ? <Empty className="mt-10" title="No contributions yet" description="Signed contributions will appear here as research work moves through the protocol." /> : <div className="mt-10 grid gap-4 md:grid-cols-2">{contributors.map((entry) => <article className="rounded-lg border border-border bg-card p-5" key={entry.actor}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium tabular-nums">{entry.actor}</h2><Badge>{entry.count} {entry.count === 1 ? 'event' : 'events'}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{[...entry.types].sort().map((type) => <Badge key={type} variant="info">{type}</Badge>)}</div><p className="mt-3 text-xs tabular-nums text-muted-foreground">Latest activity {entry.latest ?? 'unknown'}</p></article>)}</div>}
  </PageContainer>;
}
