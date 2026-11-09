'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/data';
import { Alert, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb, SectionHeader } from '@/components/ui/page';
import { ActorName, Identifier, MarginSection, TitleBlock, formatDate, formatDateTime, shortId, useActorCard } from '@/components/ui/doc';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const OUTPUT_PAGE_SIZE = 20;

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

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ').replaceAll('.', ' ');
}

function objectHref(edge) {
  const encodedId = encodeURIComponent(edge.objectId);
  const revision = Number(edge.objectRevision);
  if (edge.objectType === 'claim') return `/claims/${encodedId}${Number.isInteger(revision) && revision > 0 ? `?rev=${revision}` : ''}`;
  if (edge.objectType === 'question') return `/questions/${encodedId}`;
  if (edge.objectType === 'project') return `/projects/${encodedId}`;
  if (edge.objectType === 'task') return `/tasks/${encodedId}`;
  if (edge.objectType === 'attempt') return `/attempts/${encodedId}`;
  if (edge.objectType === 'artifact') return `/artifacts/${encodedId}`;
  const typed = { answer: 'answers', rebuttal: 'rebuttals', evaluation: 'evaluations', evidence: 'evidence', dataset: 'datasets', run: 'runs', tool: 'tools' }[edge.objectType];
  return typed ? `/${typed}/${encodedId}` : null;
}

function objectReference(edge) {
  const revision = Number(edge.objectRevision);
  return Number.isInteger(revision) && revision > 0 ? `${display(edge.objectId)}@${revision}` : display(edge.objectId);
}

function eventPath(actorId, cursor = null) {
  const base = `/events?actorId=${encodeURIComponent(actorId)}&limit=50&order=desc`;
  return cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
}

/* Human signer on an attribution edge, named from the public identity card. */
function SignerName({ actorId }) {
  const card = useActorCard(actorId);
  return card?.displayName ?? shortId(actorId);
}

/* Agent activity is a public actor view, not a second task system. It reads
 * the actor directory and formal ResearchEvents; local planning is only shown
 * when the protocol has emitted an event for it. The owning person is named
 * on every view: an agent drafts for that person and never signs. */
export default function AgentActivityPage({ params }) {
  const [actorId, setActorId] = useState(null);
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventError, setEventError] = useState(null);
  const [eventCursor, setEventCursor] = useState(null);
  const [eventNextCursor, setEventNextCursor] = useState(null);
  const [eventCursorHistory, setEventCursorHistory] = useState([]);
  const [eventPending, setEventPending] = useState(false);
  const [error, setError] = useState(null);
  const [outputPage, setOutputPage] = useState(0);

  useEffect(() => { Promise.resolve(params).then(({ actorId: value }) => setActorId(value)); }, [params]);

  async function load() {
    if (!actorId) return;
    setError(null);
    setEventError(null);
    try {
      const payload = await request(`/actors/${encodeURIComponent(actorId)}`);
      const actor = payload.actor ?? payload;
      if (actor.actorType !== 'agent' && actor.actorType !== 'service') throw new Error('Agent not found. This Actor is not registered as an agent or service.');
      setOutputPage(0);
      setData(payload);
      try {
        const eventPayload = await request(eventPath(actorId));
        setEvents(Array.isArray(eventPayload.items) ? eventPayload.items : []);
        setEventCursor(null);
        setEventNextCursor(eventPayload.nextCursor ?? null);
        setEventCursorHistory([]);
      } catch (reason) {
        setEventError(reason);
      }
    } catch (reason) {
      setError(reason);
    }
  }

  async function loadEventPage(cursor, history) {
    if (!actorId) return;
    setEventPending(true);
    setEventError(null);
    try {
      const eventPayload = await request(eventPath(actorId, cursor));
      setEvents(Array.isArray(eventPayload.items) ? eventPayload.items : []);
      setEventCursor(cursor);
      setEventNextCursor(eventPayload.nextCursor ?? null);
      setEventCursorHistory(history);
    } catch (reason) {
      setEventError(reason);
    } finally {
      setEventPending(false);
    }
  }

  useEffect(() => { load(); }, [actorId]);

  if (error) return <div className="doc-page pb-20 pt-10"><ErrorState message={error.message} onRetry={load} requestId={error.requestId ?? undefined} /></div>;
  if (!data) return <div className="doc-page pb-20 pt-8"><Skeleton className="h-4 w-64" /><Skeleton className="mt-5 h-48 w-full" /><Skeleton className="mt-8 h-96 w-full" /></div>;

  const actor = data.actor ?? data;
  const produced = Array.isArray(data.produced) ? data.produced : [];
  const used = Array.isArray(data.used) ? data.used : [];
  // One object can carry both a produced and a used edge; render it once, produced wins.
  const producedSet = new Set(produced);
  const seenOutputs = new Set();
  const allOutputs = [...produced, ...used].filter((edge) => {
    const dedupeKey = `${edge.objectType}-${edge.objectId}`;
    if (seenOutputs.has(dedupeKey)) return false;
    seenOutputs.add(dedupeKey);
    return true;
  });
  const outputStart = outputPage * OUTPUT_PAGE_SIZE;
  const outputs = allOutputs.slice(outputStart, outputStart + OUTPUT_PAGE_SIZE);
  const hasPreviousOutputs = outputPage > 0;
  const hasNextOutputs = outputStart + OUTPUT_PAGE_SIZE < allOutputs.length;
  const lastEvent = data.lastEventAt ?? events[0]?.createdAt ?? actor.updatedAt ?? null;
  const owner = actor.ownerActorId;

  return (
    <div className="doc-page pb-20 pt-5 sm:pt-6">
      <Breadcrumb
        trail={[
          { label: 'Explore', href: '/explore' },
          { label: display(actor.displayName, 'Agent') },
        ]}
      />

      <TitleBlock
        cells={[
          { label: 'Acts for', bare: true, value: owner ? <span className="inline-flex flex-wrap items-baseline gap-x-1.5 text-muted-foreground">Drafts for <ActorName actorId={owner} showOwner={false} /><span aria-hidden="true">·</span>never signs</span> : <span className="text-muted-foreground">Owner not stated; never signs</span> },
          { label: 'Last activity', value: formatDate(lastEvent) ? <span className="tabular-nums">{formatDate(lastEvent)}</span> : null },
          { label: 'Identifier', bare: true, value: <Identifier value={display(actor.actorId, actorId)} /> },
        ]}
        kind={actor.actorType === 'service' ? 'Service' : 'Agent'}
        serif={false}
        status={<StatusBadge label={display(actor.identityStrength, 'identity unknown')} state={actor.identityStrength === 'verified' ? 'accepted' : 'quiet'} />}
        title={display(actor.displayName, actor.actorId ?? actorId)}
      />

      <div className="doc-grid mt-6">
        <div className="doc-main grid gap-8">
          <section aria-labelledby="trail-heading">
            <SectionHeader action={events.length > 0 ? <span className="tabular-nums text-muted-foreground">{events.length}</span> : null} id="trail-heading" title="Attempt trail" />
            {eventError ? <Alert className="mt-3" description={`${eventError.message}${eventError.requestId ? ` · request ${eventError.requestId}` : ''}`} title="Activity events are temporarily unavailable" variant="warning" /> : null}
            {events.length === 0 && !eventError ? (
              <p className="clause__none mt-3">None yet.</p>
            ) : (
              <ol aria-label="Agent attempt events">
                {events.map((event) => {
                  const attemptId = event.payload?.attempt_id ?? event.payload?.attemptId ?? (event.objectType === 'attempt' ? event.objectId : null);
                  const entityId = event.payload?.entity_id ?? null;
                  const entityType = event.payload?.entity_type ?? null;
                  const entityHref = entityId && entityType ? objectHref({ objectType: entityType, objectId: entityId, objectRevision: event.payload?.revision }) : null;
                  const doc = event.payload?.typed_document ?? {};
                  const words = doc.title ?? doc.statement ?? doc.rationale ?? doc.synthesis ?? null;
                  return (
                    <li className="ref-row" key={event.eventId ?? `${event.eventType}-${event.createdAt}`}>
                      <p className="text-sm text-muted-foreground">{readable(display(event.eventType, 'research event'))}</p>
                      <div className="min-w-0">
                        {entityHref ? <Link className={words ? 'ref-row__title hover:underline' : 'text-sm hover:underline'} href={entityHref} title={entityId}>{words ?? <>{readable(entityType)} <span className="font-mono text-xs text-muted-foreground">{shortId(entityId)}</span></>}</Link> : <span className="font-mono text-xs text-muted-foreground" title={event.eventId}>{shortId(display(event.eventId))}</span>}
                        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {attemptId ? <Link className="hover:text-primary hover:underline" href={`/attempts/${encodeURIComponent(attemptId)}`} title={attemptId}>attempt <span className="font-mono">{shortId(attemptId)}</span></Link> : null}
                          {event.payload?.publisher_actor_id ? <span className="inline-flex flex-wrap items-baseline gap-x-1.5">signed by <ActorName actorId={event.payload.publisher_actor_id} showOwner={false} /></span> : null}
                        </p>
                      </div>
                      <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={event.createdAt} title={formatDateTime(event.createdAt) ?? undefined}>{formatDate(event.createdAt) ?? ''}</time>
                    </li>
                  );
                })}
              </ol>
            )}
            {(eventCursorHistory.length > 0 || eventNextCursor) ? (
              <nav aria-label="Attempt trail pages" className="mt-3 flex justify-end gap-2">
                <Button disabled={eventPending || eventCursorHistory.length === 0} onClick={() => loadEventPage(eventCursorHistory.at(-1) ?? null, eventCursorHistory.slice(0, -1))} size="sm" type="button" variant="outline">Previous activity</Button>
                <Button disabled={eventPending || !eventNextCursor} onClick={() => loadEventPage(eventNextCursor, [...eventCursorHistory, eventCursor])} size="sm" type="button" variant="outline">Next activity</Button>
              </nav>
            ) : null}
          </section>

          <section aria-labelledby="output-heading">
            <SectionHeader action={allOutputs.length > 0 ? <span className="tabular-nums text-muted-foreground">{allOutputs.length}</span> : null} id="output-heading" title="Public output" />
            {allOutputs.length === 0 ? <p className="clause__none mt-3">None yet.</p> : (
              <>
                <ul>
                  {outputs.map((edge, index) => {
                    const href = objectHref(edge);
                    return (
                      <li className="ref-row" key={`${edge.objectType}-${edge.objectId}-${outputStart + index}`}>
                        <p className="text-sm text-muted-foreground">{edge.edgeType ?? (producedSet.has(edge) ? 'produced' : 'used')}</p>
                        <div className="min-w-0">
                          {href ? <Link className="text-sm hover:underline" href={href} title={objectReference(edge)}>{readable(edge.objectType)} <span className="font-mono text-xs text-muted-foreground">{shortId(edge.objectId)}</span></Link> : <span className="text-sm" title={objectReference(edge)}>{readable(edge.objectType)} <span className="font-mono text-xs text-muted-foreground">{shortId(edge.objectId)}</span></span>}
                          <p className="mt-0.5 text-xs text-muted-foreground">{edge.signedBy ? <>signed by <Link className="font-medium text-foreground hover:underline" href={`/people/${encodeURIComponent(edge.signedBy)}`} title={edge.signedBy}><SignerName actorId={edge.signedBy} /></Link></> : 'signature not stated'}</p>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{edge.objectRevision ? `r${edge.objectRevision}` : ''}</span>
                      </li>
                    );
                  })}
                </ul>
                {(hasPreviousOutputs || hasNextOutputs) ? (
                  <nav aria-label="Public output pages" className="mt-3 flex justify-end gap-2">
                    <Button disabled={!hasPreviousOutputs} onClick={() => setOutputPage((page) => Math.max(0, page - 1))} size="sm" type="button" variant="outline">Previous outputs</Button>
                    <Button disabled={!hasNextOutputs} onClick={() => setOutputPage((page) => page + 1)} size="sm" type="button" variant="outline">Next outputs</Button>
                  </nav>
                ) : null}
              </>
            )}
          </section>
        </div>

        <aside aria-label="Agent identity card" className="doc-margin">
          <MarginSection title="Identity card">
            <p className="mb-2 text-xs text-muted-foreground">Self-declared, not verified</p>
            <dl className="grid gap-2 text-[13px]">
              <div><dt className="text-xs text-muted-foreground">Acts for</dt><dd className="mt-0.5">{owner ? <ActorName actorId={owner} showOwner={false} /> : <span className="text-muted-foreground">not stated</span>}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Type</dt><dd className="mt-0.5">{display(actor.actorType, 'not stated')}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Model</dt><dd className="mt-0.5 break-all font-mono text-xs">{display(actor.modelName)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Runtime</dt><dd className="mt-0.5 break-all font-mono text-xs">{display(actor.runtime)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Scope</dt><dd className="mt-0.5 break-all font-mono text-xs">{display(actor.scope)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Signing key</dt><dd className="mt-0.5 break-all font-mono text-xs">{display(actor.publicKeyFingerprint)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Connection</dt><dd className="mt-0.5 break-words">{display(actor.connectionMethod)}</dd></div>
            </dl>
          </MarginSection>
          <MarginSection title="Record">
            <Link className="text-[13px] text-primary hover:underline" href={`/events?actorId=${encodeURIComponent(actor.actorId ?? actorId)}`}>Event audit</Link>
          </MarginSection>
        </aside>
      </div>
    </div>
  );
}
