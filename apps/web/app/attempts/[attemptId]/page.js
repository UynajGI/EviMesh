'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/data';
import { Button } from '@/components/ui/button';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb, SectionHeader } from '@/components/ui/page';
import { ActorName, Identifier, MarginSection, TitleBlock, formatDateTime } from '@/components/ui/doc';
import { actorHref } from '@/components/attribution';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Attempt data is unavailable.');
  return payload;
}

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ').replaceAll('.', ' ');
}

/*
 * Attempt trail (M13.8 07-emerging-ui-spec.md §2) in the controlled-document
 * grammar: one attributable research attempt by a person or their agent.
 * Attribution chains are explicit; agent output never impersonates a person;
 * publishing stays a human decision.
 */
export default function AttemptDetailPage({ params }) {
  const [attemptId, setAttemptId] = useState(null);
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [agentRecord, setAgentRecord] = useState(null);
  const [error, setError] = useState(null);
  const [shared, setShared] = useState(false);

  useEffect(() => { Promise.resolve(params).then(({ attemptId: value }) => setAttemptId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const payload = await request(`/attempts/${attemptId}`);
      setData(payload);
      request(`/events?objectType=attempt&objectId=${attemptId}&limit=20`).then((body) => setEvents(body.items ?? [])).catch(() => setEvents([]));
      /* Agent identity card + public output: the actors endpoint returns the
       * identity card row; self-declared fields are null until the actor
       * owner records them. */
      const act = payload.attempt?.actor ?? payload.attempt?.actorId ?? payload.attempt?.createdBy;
      if (typeof act === 'string' && act.trim()) {
        request(`/actors/${encodeURIComponent(act)}`).then(setAgentRecord).catch(() => setAgentRecord(null));
      }
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (attemptId) load(); }, [attemptId]);
  useEffect(() => {
    const label = data?.attempt?.attemptId ?? attemptId ?? '';
    document.title = label ? `${String(label).slice(0, 48)} · EviMesh` : 'EviMesh';
  }, [data, attemptId]);

  if (error) return <div className="doc-page pb-20 pt-10"><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return <div className="doc-page pb-20 pt-8"><Skeleton className="h-4 w-64" /><Skeleton className="mt-5 h-48 w-full" /><Skeleton className="mt-8 h-64 w-full" /></div>;

  const attempt = data.attempt ?? data;
  const actor = attempt.actor ?? attempt.actorId ?? attempt.createdBy;
  const revision = attempt.attemptRevision ?? attempt.revision;
  /* Identity card fields from the actors endpoint; null stays "not stated". */
  const card = agentRecord?.actor ?? {};
  const actorIsAgent = card.actorType === 'agent' || card.actorType === 'service';
  const recordHref = typeof actor === 'string' ? actorHref(actor, actorIsAgent ? 'agent' : card.actorType) : null;
  const links = [
    attempt.taskId ? { label: 'Task', href: `/tasks/${attempt.taskId}`, value: attempt.taskId } : null,
    attempt.claimId ? { label: 'Claim', href: `/claims/${attempt.claimId}`, value: attempt.claimId } : null,
    attempt.evidenceId ? { label: 'Evidence', href: `/evidence/${attempt.evidenceId}`, value: attempt.evidenceId } : null,
    attempt.artifactId ? { label: 'Artifact', href: `/artifacts/${attempt.artifactId}`, value: attempt.artifactId } : null,
    attempt.runId ? { label: 'Run', href: `/runs/${attempt.runId}`, value: attempt.runId } : null,
  ].filter(Boolean);
  const outputs = [...(agentRecord?.produced ?? []), ...(agentRecord?.used ?? [])].slice(0, 10);
  const outputHref = (edge) => ({ claim: `/claims/${edge.objectId}`, question: `/questions/${edge.objectId}`, project: `/projects/${edge.objectId}`, task: `/tasks/${edge.objectId}` })[edge.objectType] ?? null;

  return (
    <div className="doc-page pb-24 pt-6 sm:pt-8">
      <Breadcrumb
        trail={[
          { label: 'Work', href: '/work' },
          ...(attempt.taskId ? [{ label: 'Task', href: `/tasks/${attempt.taskId}` }] : []),
          { label: `Attempt${revision ? ` r${revision}` : ''}` },
        ]}
      />

      <TitleBlock
        actions={(
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
              } catch { /* unavailable */ }
            }}
            size="sm"
            variant="outline"
          >
            {shared ? <Check aria-hidden="true" size={14} /> : <Link2 aria-hidden="true" size={14} />}
            {shared ? 'Link copied' : 'Share trail'}
          </Button>
        )}
        cells={[
          { label: 'Identifier', value: <Identifier value={attempt.attemptId ?? attemptId} /> },
          { label: 'Revision', value: revision ? <span className="tabular-nums">r{revision}</span> : null },
          { label: 'Attempted by', value: typeof actor === 'string' ? <ActorName actorId={actor} /> : null },
          { label: 'Last activity', value: <span className="tabular-nums">{formatDateTime(data?.traceSummary?.lastEventAt) ?? 'no events yet'}</span> },
        ]}
        kind="Attempt trail"
        notice={<p className="max-w-[68ch] text-base leading-7 text-muted-foreground">One attributable research attempt. Agents draft; people approve what gets signed. Attribution chains are part of the record, not metadata.</p>}
        serif={false}
        status={<StatusBadge state={attempt.state ?? attempt.status ?? 'active'} />}
        title={`Attempt trail${revision ? ` r${revision}` : ''}`}
      />

      <div className="doc-grid mt-10">
        <div className="doc-main grid gap-12">
          <section aria-labelledby="trail-heading">
            <SectionHeader action={<Link className="text-primary hover:underline" href="/events">Full event audit →</Link>} id="trail-heading" title="Trace" />
            {events.length === 0 ? (
              <Empty
                className="mt-4"
                description="Steps that change research state become signed events. Local planning stays local; when this attempt produces events, they appear here with their hashes in the audit."
                title="No signed events for this attempt yet"
              />
            ) : (
              <ol className="mt-4 border-t border-border">
                {events.map((event) => (
                  <li className="ref-row" key={event.eventId}>
                    <p className="text-sm text-muted-foreground">{readable(event.eventType ?? 'event')}</p>
                    <div className="min-w-0"><span className="font-mono text-xs">{event.eventId}</span></div>
                    <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={event.createdAt}>{formatDateTime(event.createdAt) ?? ''}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Produced/used attribution edges from the actors endpoint. Only
            * rendered when the actor resolves as an agent. */}
          {actorIsAgent && agentRecord ? (
            <section aria-labelledby="output-heading">
              <SectionHeader id="output-heading" title="This agent's public output" />
              {outputs.length === 0 ? (
                <Empty className="mt-4" title="No public output yet" description="Objects this agent produced or used will appear here as signed attribution edges." />
              ) : (
                <ul className="mt-4 border-t border-border">
                  {outputs.map((edge, index) => (
                    <li className="ref-row" key={`${edge.objectType}-${edge.objectId}-${index}`}>
                      <p className="text-sm text-muted-foreground">{edge.edgeType ?? 'linked'}</p>
                      <div className="min-w-0">
                        {outputHref(edge) ? <Link className="text-sm font-medium hover:underline" href={outputHref(edge)}>{readable(edge.objectType)} <span className="font-mono text-xs">{edge.objectId}</span></Link> : <span className="text-sm">{readable(edge.objectType)} <span className="font-mono text-xs">{edge.objectId}</span></span>}
                      </div>
                      <span />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>

        <aside aria-label="Attempt context" className="doc-margin">
          {/* What the public API can attest today, with the self-declaration
            * boundary stated instead of faked. */}
          {typeof actor === 'string' ? (
            <MarginSection title="Identity card">
              <dl className="grid gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Actor</dt><dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2"><ActorName actorId={actor} showOwner={false} /><Link className="text-xs text-primary hover:underline" href={recordHref}>record</Link></dd></div>
                {card.ownerActorId ? <div><dt className="text-xs text-muted-foreground">Acts for</dt><dd className="mt-0.5"><ActorName actorId={card.ownerActorId} showOwner={false} /></dd></div> : null}
                {agentRecord?.roles?.length > 0 ? <div><dt className="text-xs text-muted-foreground">Roles</dt><dd className="mt-0.5">{agentRecord.roles.slice(0, 6).map((role) => role.role).join(', ')}</dd></div> : null}
                <div><dt className="text-xs text-muted-foreground">Type</dt><dd className="mt-0.5">{card.actorType ?? 'not stated'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Model</dt><dd className="mt-0.5 break-all font-mono text-xs">{card.modelName ?? 'not stated'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Runtime</dt><dd className="mt-0.5 break-all font-mono text-xs">{card.runtime ?? 'not stated'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Scope</dt><dd className="mt-0.5 break-all font-mono text-xs">{card.scope ?? 'not stated'}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Signing key</dt><dd className="mt-0.5 break-all font-mono text-xs">{card.publicKeyFingerprint ?? 'not stated'}</dd></div>
              </dl>
              <p className="mt-3 text-xs font-medium">Self-declared, not verified</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">A self-reported model is a declaration, not a verification result.</p>
            </MarginSection>
          ) : null}

          <MarginSection title="Linked objects">
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked objects recorded on this attempt yet.</p>
            ) : (
              <dl className="grid gap-3 text-sm">
                {links.map((link) => (
                  <div key={link.label}>
                    <dt className="text-xs text-muted-foreground">{link.label}</dt>
                    <dd className="mt-0.5"><Link className="break-all font-mono text-xs hover:text-primary hover:underline" href={link.href} title={link.value}>{link.value}</Link></dd>
                  </div>
                ))}
              </dl>
            )}
          </MarginSection>
        </aside>
      </div>
    </div>
  );
}
