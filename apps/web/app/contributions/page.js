'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { RoleBar, CONTRIBUTION_ROLES } from '@/components/role-bar';
import { actorHref } from '@/components/attribution';
import { apiFetch } from '@/lib/api-client';

function actorLabel(actorId) {
  return actorId ?? 'Unknown contributor';
}

/* Contribution-role hint from an event type: deterministic, count-only. */
function roleForEventType(type) {
  const t = type ?? '';
  if (t.startsWith('claim') && (t.includes('created') || t.includes('proposed'))) return 'originator';
  if (t.startsWith('verification') || t.startsWith('receipt')) return 'verifier';
  if (t.startsWith('challenge')) return 'reviewer';
  if (t.startsWith('witness') || t.startsWith('checkpoint')) return 'witness';
  return 'contributor';
}

export default function ContributionsPage() {
  const [events, setEvents] = useState([]);
  const [actorTypes, setActorTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const [body, directory] = await Promise.all([
        apiFetch('/events?limit=100'),
        apiFetch('/actors?limit=200').catch(() => ({ items: [] })),
      ]);
      setEvents(body.items ?? []);
      setActorTypes(Object.fromEntries((directory.items ?? []).map((actor) => [actor.actorId, actor.actorType])));
    } catch (reason) {
      setError(reason.message);
      setRequestId(reason.requestId ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { document.title = 'Contributions · EviMesh'; }, []);

  const overallCounts = useMemo(() => {
    const counts = Object.fromEntries(CONTRIBUTION_ROLES.map((role) => [role, 0]));
    for (const event of events) counts[roleForEventType(event.eventType)] += 1;
    return counts;
  }, [events]);


  if (error) {
    return <PageContainer><PageHeader eyebrow="Shared credit" title="Contributions" description="See the people and roles behind each verified step of scientific progress." /><ErrorState className="mt-8" message={error} requestId={requestId} onRetry={load} /></PageContainer>;
  }

  const byActor = new Map();
  for (const event of events) {
    const actor = actorLabel(event.actorId);
    if (!byActor.has(actor)) byActor.set(actor, { actor, count: 0, types: new Set(), roleCounts: {}, latest: event.createdAt });
    const entry = byActor.get(actor);
    entry.count += 1;
    if (event.eventType) entry.types.add(event.eventType);
    const role = roleForEventType(event.eventType);
    entry.roleCounts[role] = (entry.roleCounts[role] ?? 0) + 1;
    if (event.createdAt && (!entry.latest || event.createdAt > entry.latest)) entry.latest = event.createdAt;
  }
  const contributors = [...byActor.values()].sort((left, right) => right.count - left.count);


  return <PageContainer wide><PageHeader eyebrow="Shared credit" title="Contributions" description="See the people and roles behind each verified step of scientific progress." />
    {loading ? <Skeleton className="mt-10 h-96 w-full" /> : contributors.length === 0 ? <Empty className="mt-10" title="No contributions yet" description="Signed contributions will appear here as research work moves through the protocol." /> : <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">{contributors.map((entry) => {
        const counts = entry.roleCounts;
        return (
          <article className="rounded-lg border border-border bg-card p-5" key={entry.actor}>
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">{entry.actor.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0">
                <Link className="block truncate font-medium tabular-nums hover:underline" href={actorHref(entry.actor, actorTypes[entry.actor])}>{entry.actor}</Link>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{entry.count} {entry.count === 1 ? 'event' : 'events'} · latest {entry.latest ?? 'unknown'}</p>
              </div>
            </div>
            <RoleBar className="mt-4" counts={counts} />
            <div className="mt-3 flex flex-wrap gap-2">{[...entry.types].sort().slice(0, 4).map((type) => <StatusBadge key={type} label={type} state={roleForEventType(type)} />)}</div>
          </article>
        );
      })}</div>
      <aside aria-label="Overall role distribution" className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-20">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall role distribution</h2>
        <RoleBar className="mt-3" counts={overallCounts} />
        <p className="mt-3 text-xs text-muted-foreground">Counts only, never points or rankings. Each contributor card links to the public record with the signed events behind it.</p>
      </aside>
    </div>}
  </PageContainer>;
}
