'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileCheck2, FlaskConical, GitPullRequestArrow, History } from 'lucide-react';
import { StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader } from '@/components/ui/page';
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
    return <PageContainer><PageHeader eyebrow="Trust layer" title="Event audit" description="Inspect signed ResearchEvents and their immutable parent hash chain." /><ErrorState className="mt-8" message={error} requestId={requestId} onRetry={load} /></PageContainer>;
  }

  return <PageContainer wide><PageHeader eyebrow="Trust layer" title="Event audit" description="Inspect signed ResearchEvents and their immutable parent hash chain. Natural language first; hashes and signatures stay one layer down per event." />
    {loading ? <Skeleton className="mt-10 h-96 w-full" /> : events.length === 0 ? <Empty className="mt-10" title="No ResearchEvents available" description="Signed events will appear here as research work moves through the protocol." /> : <section className="mt-10"><div className="rounded-lg border border-border bg-card px-5 py-2"><ol className="list-none">{events.map((event) => {
      const type = event.eventType ?? 'event';
      const EventIcon = type.startsWith('frontier') ? FileCheck2 : type.startsWith('claim') ? GitPullRequestArrow : type.startsWith('evidence') ? FlaskConical : History;
      return (
        <li className="grid scroll-mt-24 grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-border py-4 last:border-b-0" id={`event-${event.eventId}`} key={event.eventId} tabIndex={-1}>
          <span aria-hidden="true" className="mt-0.5 grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"><EventIcon size={15} /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={type} state="update" />
              <IdChip value={event.eventId} />
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{event.createdAt ?? 'Unknown'}</span>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">Technical details: hash, signature, parents</summary>
              <dl className="mt-2 grid gap-3 text-sm md:grid-cols-2">
                <div><dt className="text-muted-foreground">Hash</dt><dd className="mt-1 break-all font-mono text-xs tabular-nums">{event.hash ?? 'Missing'}</dd></div>
                <div><dt className="text-muted-foreground">Signature</dt><dd className="mt-1 break-all font-mono text-xs tabular-nums">{typeof event.signature === 'object' ? JSON.stringify(event.signature) : event.signature ?? 'Missing'}</dd></div>
                <div><dt className="text-muted-foreground">Parents</dt><dd className="mt-1 font-mono text-xs tabular-nums">{(event.parents ?? []).join(', ') || 'Genesis event'}</dd></div>
                <div><dt className="text-muted-foreground">Created</dt><dd className="mt-1 tabular-nums">{event.createdAt ?? 'Unknown'}</dd></div>
              </dl>
            </details>
          </div>
        </li>
      );
    })}</ol></div></section>}
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
