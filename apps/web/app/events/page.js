'use client';

import { useEffect, useState } from 'react';
import { FileCheck2, FlaskConical, GitPullRequestArrow, History } from 'lucide-react';
import { StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
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

  return <PageContainer wide><PageHeader eyebrow="Trust layer" title="Event audit" description="Inspect signed ResearchEvents and their immutable parent hash chain. Natural language first; hashes and signatures stay one layer down per event." />
    {loading ? <Skeleton className="mt-10 h-96 w-full" /> : events.length === 0 ? <Empty className="mt-10" title="No ResearchEvents available" description="Signed events will appear here as research work moves through the protocol." /> : <section className="mt-10"><div className="rounded-lg border border-border bg-card px-5 py-2"><ol className="list-none">{events.map((event) => {
      const type = event.eventType ?? 'event';
      const EventIcon = type.startsWith('frontier') ? FileCheck2 : type.startsWith('claim') ? GitPullRequestArrow : type.startsWith('evidence') ? FlaskConical : History;
      return (
        <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-border py-4 last:border-b-0" key={event.eventId}>
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
