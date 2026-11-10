'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Identifier, formatDateTime } from '@/components/ui/doc';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { ProvenanceList } from '@/components/ui/provenance-list';
import { apiFetch } from '@/lib/api-client';

const EVENT_FILTERS = ['objectType', 'objectId', 'createdAfter', 'createdBefore', 'eventType', 'actorId'];

function eventQuery(search = '') {
  const input = new URLSearchParams(search);
  const query = new URLSearchParams({ limit: '100', order: input.get('order') === 'asc' ? 'asc' : 'desc' });
  for (const key of EVENT_FILTERS) {
    const value = input.get(key);
    if (value) query.set(key, value);
  }
  return `/events?${query.toString()}`;
}

function EventsAuditView() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const body = await apiFetch(eventQuery(searchParams.toString()));
      setEvents(body.items ?? []);
    } catch (reason) {
      setError(reason.message);
      setRequestId(reason.requestId ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [searchParams]);

  useEffect(() => {
    if (loading || typeof window === 'undefined' || !window.location.hash) return;
    let targetId;
    try {
      targetId = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!targetId.startsWith('event-')) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }, [events, loading]);

  if (error) {
    return <PageContainer><PageHeader title="Event audit" /><ErrorState className="mt-8" message={error} requestId={requestId} onRetry={load} /></PageContainer>;
  }

  return <PageContainer wide><PageHeader title="Event audit" />
    {loading ? <Skeleton className="mt-8 h-96 w-full" /> : events.length === 0 ? <Empty className="mt-8" title="No events yet" /> : <section className="mt-6"><ol className="list-none">{events.map((event) => {
      const type = event.eventType ?? 'event';
      return (
        <li className="scroll-mt-24 border-b border-border py-3 focus:outline-none focus-visible:bg-muted" id={`event-${event.eventId}`} key={event.eventId} tabIndex={-1}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-sm text-foreground">{type}</span>
              <Identifier value={event.eventId} />
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatDateTime(event.createdAt) ?? event.createdAt ?? 'Unknown'}</span>
            </div>
            <ProvenanceList
              fields={[
                { label: 'Hash', value: event.hash ?? 'Missing' },
                { label: 'Signature', value: typeof event.signature === 'object' ? JSON.stringify(event.signature) : event.signature ?? 'Missing' },
                { label: 'Parents', value: (event.parents ?? []).join(', ') || 'Genesis event' },
                { label: 'Created', value: event.createdAt ?? 'Unknown', mono: false },
              ]}
            />
          </div>
        </li>
      );
    })}</ol></section>}
  </PageContainer>;
}

export default function EventsAuditPage() {
  // useSearchParams opts this route into dynamic rendering; the Suspense
  // boundary keeps the static shell renderable (same pattern as /explore).
  return (
    <Suspense fallback={<PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>}>
      <EventsAuditView />
    </Suspense>
  );
}
