'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bot, Check, Share2, UserRound } from 'lucide-react';
import { Card, CardContent, StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer } from '@/components/ui/page';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Attempt data is unavailable.');
  return payload;
}

function toRelativeTime(value) {
  return <span title={value ?? undefined}>{relativeTime(value)}</span>;
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

/*
 * Attempt trail (M13.8 07-emerging-ui-spec.md §2): one attributable research
 * attempt by a human or their agent. Attribution chains are explicit; agent
 * output never impersonates a human; publishing stays a human decision.
 */
export default function AttemptDetailPage({ params }) {
  const [attemptId, setAttemptId] = useState(null);
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [shared, setShared] = useState(false);

  useEffect(() => { Promise.resolve(params).then(({ attemptId: value }) => setAttemptId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const payload = await request(`/attempts/${attemptId}`);
      setData(payload);
      request(`/events?objectType=attempt&objectId=${attemptId}&limit=20`).then((body) => setEvents(body.items ?? [])).catch(() => setEvents([]));
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (attemptId) load(); }, [attemptId]);

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-24 w-full" /><Skeleton className="mt-6 h-64 w-full" /></PageContainer>;

  const attempt = data.attempt ?? data;
  const actor = attempt.actor ?? attempt.actorId ?? attempt.createdBy;
  const actorIsAgent = typeof actor === 'string' && /agent|bot|atlas|merope/i.test(actor);
  const revision = attempt.attemptRevision ?? attempt.revision;
  const links = [
    attempt.taskId ? { label: 'Task', href: `/tasks/${attempt.taskId}`, value: attempt.taskId } : null,
    attempt.claimId ? { label: 'Claim', href: `/claims/${attempt.claimId}`, value: attempt.claimId } : null,
    attempt.evidenceId ? { label: 'Evidence', href: null, value: attempt.evidenceId } : null,
    attempt.artifactId ? { label: 'Artifact', href: `/artifacts/${attempt.artifactId}`, value: attempt.artifactId } : null,
    attempt.runId ? { label: 'Run', href: null, value: attempt.runId } : null,
  ].filter(Boolean);

  useEffect(() => {
    const label = attempt?.attemptId ?? '';
    document.title = label ? `${String(label).slice(0, 48)} · EviMesh` : 'EviMesh';
  }, [attempt]);
  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {attempt.taskId ? (
          <>
            <Link className="hover:text-foreground" href="/work">Work</Link>
            <span aria-hidden="true">/</span>
            <Link className="tabular-nums hover:text-foreground" href={`/tasks/${attempt.taskId}`}>{attempt.taskId}</Link>
          </>
        ) : (
          <Link className="hover:text-foreground" href="/work">Work</Link>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="tabular-nums">{attempt.attemptId ?? attemptId}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-5">
          <span aria-hidden="true" className={cn('grid size-16 shrink-0 place-items-center rounded-full', actorIsAgent ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground')}>
            {actorIsAgent ? <Bot size={28} /> : <UserRound size={28} />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {actorIsAgent ? <StatusBadge state="update" label="agent" /> : null}
              <StatusBadge state="active_question" label="attributed attempt" />
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Attempt trail{revision ? ' · r' + revision : ''}</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">One attributable research attempt. Agents draft; humans approve what gets signed. Attribution chains are part of the record, not metadata.</p>
          </div>
        </div>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setShared(true);
              setTimeout(() => setShared(false), 2000);
            } catch { /* unavailable */ }
          }}
          type="button"
        >
          {shared ? <Check aria-hidden="true" size={14} /> : <Share2 aria-hidden="true" size={14} />}
          {shared ? 'Link copied' : 'Share trail'}
        </button>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <StatusBadge state={attempt.state ?? attempt.status ?? 'active'} />
        <IdChip label="attempt" value={attempt.attemptId ?? attemptId} />
        {actor ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            by
            {typeof actor === 'string' && !actorIsAgent ? (
              <Link className="font-medium text-foreground hover:underline" href={`/contributors/${actor}`}>{actor}</Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-status-accent-border bg-status-accent-bg px-2 py-0.5 text-xs font-medium text-status-accent-fg">
                agent · {typeof actor === 'string' ? actor : JSON.stringify(actor)}
              </span>
            )}
          </span>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <section aria-labelledby="trail-heading" className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold" id="trail-heading">Trace</h2>
          {events.length === 0 ? (
            <Empty
              description="Steps that change research state become signed events. Local planning stays local; when this attempt produces events, they appear here with their hashes in the audit."
              title="No signed events for this attempt yet"
            />
          ) : (
            <Card className="divide-y divide-border">
              {events.map((event) => (
                <div className="flex flex-wrap items-center gap-3 px-5 py-3" key={event.eventId}>
                  <span className="font-mono text-xs text-muted-foreground">{event.eventType ?? 'event'}</span>
                  <IdChip value={event.eventId} />
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{toRelativeTime(event.createdAt)}</span>
                </div>
              ))}
            </Card>
          )}
          <Link className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground" href="/events">Full event audit →</Link>
        </section>

        <aside aria-label="Attempt context">
          <Card>
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Linked objects</h2>
            </div>
            <CardContent className="grid gap-3">
              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked objects recorded on this attempt yet.</p>
              ) : links.map((link) => (
                <div className="flex flex-wrap items-center gap-2" key={link.label}>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{link.label}</span>
                  {link.href ? <span className="flex flex-wrap items-center gap-2"><IdChip value={link.value} /><Link className="text-xs text-primary hover:underline" href={link.href}>open</Link></span> : <IdChip value={link.value} />}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Failed, paused, or abandoned attempts keep their links: they still carry research signal.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
