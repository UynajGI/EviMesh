'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { apiFetch } from '@/lib/api-client';

export default function EventsAuditPage() {
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
    return <PageContainer><PageHeader eyebrow="Trust layer" title="Event audit" description="Inspect signed ResearchEvents and their immutable parent hash chain." /><ErrorState className="mt-8" message={error} requestId={requestId} onRetry={load} /></PageContainer>;
  }

  return <PageContainer wide><PageHeader eyebrow="Trust layer" title="Event audit" description="Inspect signed ResearchEvents and their immutable parent hash chain." />
    {loading ? <Skeleton className="mt-10 h-96 w-full" /> : events.length === 0 ? <Empty className="mt-10" title="No ResearchEvents available" description="Signed events will appear here as research work moves through the protocol." /> : <section className="mt-10 space-y-4">{events.map((event) => <article className="rounded-lg border border-border bg-card p-5" key={event.eventId}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-mono text-sm tabular-nums">{event.eventId}</h2><Badge variant="info">{event.eventType}</Badge></div><dl className="mt-4 grid gap-3 text-sm md:grid-cols-2"><div><dt className="text-muted-foreground">Hash</dt><dd className="mt-1 break-all font-mono text-xs tabular-nums">{event.hash ?? 'Missing'}</dd></div><div><dt className="text-muted-foreground">Signature</dt><dd className="mt-1 break-all font-mono text-xs tabular-nums">{typeof event.signature === 'object' ? JSON.stringify(event.signature) : event.signature ?? 'Missing'}</dd></div><div><dt className="text-muted-foreground">Parents</dt><dd className="mt-1 font-mono text-xs tabular-nums">{(event.parents ?? []).join(', ') || 'Genesis event'}</dd></div><div><dt className="text-muted-foreground">Created</dt><dd className="mt-1 tabular-nums">{event.createdAt ?? 'Unknown'}</dd></div></dl></article>)}</section>}
  </PageContainer>;
}
