'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bot, Clock3, FileCheck2, UserRound } from 'lucide-react';
import { Card, CardContent, StatusBadge } from '@/components/ui/data';
import { Alert, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Attribution } from '@/components/attribution';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message ?? 'Agent activity is unavailable.');
    error.requestId = payload.request_id ?? payload.requestId ?? null;
    throw error;
  }
  return payload;
}

function display(value, fallback = 'not stated') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function objectHref(edge) {
  if (edge.objectType === 'claim') return `/claims/${edge.objectId}`;
  if (edge.objectType === 'question') return `/questions/${edge.objectId}`;
  if (edge.objectType === 'project') return `/projects/${edge.objectId}`;
  if (edge.objectType === 'task') return `/tasks/${edge.objectId}`;
  if (edge.objectType === 'attempt') return `/attempts/${edge.objectId}`;
  return null;
}

/* Agent activity is a public actor view, not a second task system. It reads
 * the actor directory and formal ResearchEvents; local planning is only shown
 * when the protocol has emitted an event for it. */
export default function AgentActivityPage({ params }) {
  const [actorId, setActorId] = useState(null);
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventError, setEventError] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { Promise.resolve(params).then(({ actorId: value }) => setActorId(value)); }, [params]);

  async function load() {
    if (!actorId) return;
    setError(null);
    setEventError(null);
    try {
      const payload = await request(`/actors/${encodeURIComponent(actorId)}`);
      const actor = payload.actor ?? payload;
      if (actor.actorType !== 'agent' && actor.actorType !== 'service') throw new Error('Agent not found. This Actor is not registered as an agent or service.');
      setData(payload);
      try {
        const eventPayload = await request(`/events?actorId=${encodeURIComponent(actorId)}&limit=50&order=desc`);
        setEvents(Array.isArray(eventPayload.items) ? eventPayload.items : []);
      } catch (reason) {
        setEventError(reason);
      }
    } catch (reason) {
      setError(reason);
    }
  }

  useEffect(() => { load(); }, [actorId]);

  if (error) return <PageContainer><ErrorState message={error.message} onRetry={load} requestId={error.requestId ?? undefined} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-28 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;

  const actor = data.actor ?? data;
  const produced = Array.isArray(data.produced) ? data.produced : [];
  const used = Array.isArray(data.used) ? data.used : [];
  const outputs = [...produced, ...used].slice(0, 20);
  const lastEvent = data.lastEventAt ?? events[0]?.createdAt ?? actor.updatedAt ?? null;
  const owner = actor.ownerActorId;

  return (
    <PageContainer wide>
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/explore">Explore</Link>
        <span aria-hidden="true">/</span>
        <span>Agents</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="tabular-nums">{display(actor.actorId, actorId)}</span>
      </nav>

      <PageHeader
        description="A public activity record for an agent. Formal events and attribution edges are shown as the protocol exposes them."
        eyebrow="Agent activity"
        title={display(actor.displayName, actor.actorId ?? actorId)}
      />

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          <Card>
              <div className="flex min-w-0 items-start gap-4 border-b border-border px-5 py-4">
              <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Bot size={24} /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={actor.actorType} state="update" />
                  <StatusBadge label={display(actor.identityStrength, 'identity unknown')} state={actor.identityStrength === 'verified' ? 'accepted' : 'quiet'} />
                </div>
                <Attribution actorId={actor.actorId ?? actorId} actorType={actor.actorType} className="mt-2 text-sm" label="Attribution" ownerActorId={owner} />
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2"><IdChip label="actor" value={display(actor.actorId, actorId)} /><span className="min-w-0 break-words text-xs text-muted-foreground">last activity {lastEvent ? new Date(lastEvent).toISOString().slice(0, 16).replace('T', ' ') : 'not stated'}</span></div>
              </div>
            </div>
            <CardContent>
              <div className="flex items-center gap-2"><Clock3 aria-hidden="true" className="text-muted-foreground" size={16} /><h2 className="text-sm font-semibold">Attempt trail</h2></div>
              {eventError ? <Alert className="mt-4" description={`${eventError.message}${eventError.requestId ? ` · request ${eventError.requestId}` : ''}`} title="Activity events are temporarily unavailable" variant="warning" /> : null}
              {events.length === 0 && !eventError ? (
                <Empty className="mt-4" action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/agent">Open agent center</Link>} description="Formal ResearchEvents for this agent will appear here when the protocol records them. Local planning is not silently presented as network activity." title="No formal events yet" />
              ) : (
                <ol aria-label="Agent attempt events" className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {events.map((event) => {
                    const attemptId = event.payload?.attempt_id ?? event.payload?.attemptId ?? (event.objectType === 'attempt' ? event.objectId : null);
                    return <li className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3" key={event.eventId ?? `${event.eventType}-${event.createdAt}`}>
                      <FileCheck2 aria-hidden="true" className="shrink-0 text-muted-foreground" size={16} />
                      <span className="min-w-0 break-words text-sm font-medium">{display(event.eventType, 'research event')}</span>
                      <IdChip value={display(event.eventId)} />
                      {attemptId ? <Link className="text-xs text-primary hover:underline" href={`/attempts/${encodeURIComponent(attemptId)}`}>attempt {attemptId}</Link> : null}
                      <time className="w-full text-xs tabular-nums text-muted-foreground sm:ml-auto sm:w-auto" dateTime={event.createdAt}>{event.createdAt ? new Date(event.createdAt).toISOString().slice(0, 16).replace('T', ' ') : 'time unavailable'}</time>
                    </li>;
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <section aria-labelledby="output-heading" className="mt-8">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-xl font-semibold tracking-tight" id="output-heading">Public output</h2><span className="text-sm text-muted-foreground">Produced and used attribution edges</span></div>
            {outputs.length === 0 ? <Empty description="Objects this agent produced or used will appear here with their attribution edge." title="No public output yet" /> : <ul className="divide-y divide-border rounded-lg border border-border bg-card">{outputs.map((edge, index) => { const href = objectHref(edge); return <li className="flex flex-wrap items-center gap-3 px-5 py-3.5" key={`${edge.objectType}-${edge.objectId}-${index}`}><StatusBadge label={edge.edgeType ?? (produced.includes(edge) ? 'produced' : 'used')} state="update" /><span className="text-xs text-muted-foreground">{edge.objectType}</span><IdChip value={display(edge.objectId)} />{href ? <Link className="text-xs text-primary hover:underline" href={href}>open</Link> : null}<span className="ml-auto text-xs text-muted-foreground">{edge.signedBy ? <>signed by <Link className="text-primary hover:underline" href={`/people/${encodeURIComponent(edge.signedBy)}`}>{edge.signedBy}</Link></> : 'signature not stated'}</span></li>; })}</ul>}
          </section>

          <section aria-labelledby="review-heading" className="mt-8">
            <h2 className="mb-3 text-xl font-semibold tracking-tight" id="review-heading">Human-in-the-loop boundary</h2>
            <Alert description="Agents can draft and prepare work; publication remains a human signing decision. The current public event API does not expose unresolved checkpoint state, so this page does not infer pending approval from historical event names." title="Checkpoint state not exposed" variant="info" />
          </section>
        </div>

        <aside aria-label="Agent identity card" className="grid gap-4">
          <Card className="min-w-0">
            <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity card</h2></div>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <div className="flex min-w-0 gap-3"><dt className="w-28 shrink-0 text-xs text-muted-foreground">Type</dt><dd className="min-w-0 break-words">{display(actor.actorType, 'not stated')}</dd></div>
                <div className="flex min-w-0 gap-3"><dt className="w-28 shrink-0 text-xs text-muted-foreground">Model</dt><dd className="min-w-0 break-all font-mono text-xs">{display(actor.modelName)}</dd></div>
                <div className="flex min-w-0 gap-3"><dt className="w-28 shrink-0 text-xs text-muted-foreground">Runtime</dt><dd className="min-w-0 break-all font-mono text-xs">{display(actor.runtime)}</dd></div>
                <div className="flex min-w-0 gap-3"><dt className="w-28 shrink-0 text-xs text-muted-foreground">Scope</dt><dd className="min-w-0 break-all font-mono text-xs">{display(actor.scope)}</dd></div>
                <div className="flex min-w-0 gap-3"><dt className="w-28 shrink-0 text-xs text-muted-foreground">Signing key</dt><dd className="min-w-0 break-all font-mono text-xs">{display(actor.publicKeyFingerprint)}</dd></div>
                <div className="flex min-w-0 gap-3"><dt className="w-28 shrink-0 text-xs text-muted-foreground">Connection</dt><dd className="min-w-0 break-words">{display(actor.connectionMethod)}</dd></div>
              </dl>
              <Alert className="mt-4" description="Self-declared model and runtime fields are declarations, not verification findings. The agent never impersonates a human." title="Self-declared, not verified" variant="info" />
              {owner ? <Link className="mt-4 inline-flex items-center gap-2 text-xs text-primary hover:underline" href={`/people/${encodeURIComponent(owner)}`}><UserRound aria-hidden="true" size={14} />View owning human actor</Link> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
