import Link from 'next/link';
import { buttonLinkVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/data';
import { ActorName, MarginSection } from '@/components/ui/doc';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function readList(path) {
  if (!API) return [];
  try {
    const response = await fetch(`${API}${path}`, { cache: 'no-store' });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body) ? body : body.items ?? [];
  } catch {
    return [];
  }
}

function dateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString().slice(0, 10);
}

/* Same shape as shortId in components/ui/doc.js (a client module). */
function shortId(value) {
  if (!value) return '';
  const underscore = value.indexOf('_');
  const head = underscore > 0 ? value.slice(0, underscore + 7) : value.slice(0, 7);
  return value.length > head.length + 4 ? `${head}…${value.slice(-4)}` : value;
}

function text(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? null;
}

/* List endpoints carry no titles or statements. Read the words of the rows
 * this page renders from their detail endpoints; failures keep the row. */
async function readDetail(path) {
  if (!API) return null;
  try {
    const response = await fetch(`${API}${path}`, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function hydrateTask(task) {
  if (task.title || !task.taskId) return task;
  const detail = await readDetail(`/tasks/${encodeURIComponent(task.taskId)}`);
  const title = text(detail?.currentRevision?.title, detail?.task?.title);
  return title ? { ...task, title, projectId: task.projectId ?? detail?.task?.projectId ?? null } : task;
}

async function hydrateClaim(claim) {
  if (claim.statement || claim.title || !claim.claimId) return claim;
  const detail = await readDetail(`/claims/${encodeURIComponent(claim.claimId)}`);
  const statement = text(detail?.currentRevision?.statement);
  return statement ? { ...claim, statement } : claim;
}

const OBJECT_PATHS = Object.freeze({
  question: '/questions', answer: '/answers', claim: '/claims', rebuttal: '/rebuttals', evaluation: '/evaluations',
  evidence: '/evidence', dataset: '/datasets', tool: '/tools', run: '/runs', task: '/tasks', project: '/projects',
});

function sentenceCase(value) {
  const words = String(value ?? '').replaceAll('_', ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}

/* "claim.created" reads "Claim created"; "governance.project_application_decided"
 * reads "Project application decided". */
function eventWords(eventType) {
  const parts = String(eventType ?? '').split('.').filter(Boolean);
  if (parts.length === 0) return 'Event recorded';
  if (parts[0] === 'governance') return sentenceCase(parts.slice(1).join(' ')) || 'Governance decision';
  return sentenceCase(parts.join(' '));
}

/* Each event payload names the object it changed and carries its typed words. */
function describeEvent(event) {
  const payload = event.payload ?? {};
  const doc = payload.typed_document ?? {};
  const entityType = text(payload.entity_type, event.objectType) ?? (payload.project_id && !payload.entity_id ? 'project' : null);
  const entityId = text(payload.entity_id, event.objectId) ?? (entityType === 'project' ? text(payload.project_id) : null);
  const words = text(doc.title, doc.statement, doc.name, doc.argument, doc.synthesis, doc.rationale, entityType === 'project' ? payload.project_name : null);
  const prefix = entityType ? OBJECT_PATHS[entityType] : null;
  const drafter = text(payload.drafted_by_actor_id, payload.producer_actor_id);
  const signer = text(payload.publisher_actor_id, payload.signer_actor_id);
  const recorder = text(event.actorId, event.createdBy, event.signedBy, payload.actor_id);
  return {
    action: eventWords(event.eventType),
    entityType,
    entityId,
    words,
    href: prefix && entityId ? `${prefix}/${encodeURIComponent(entityId)}` : null,
    drafter: drafter && drafter !== signer ? drafter : null,
    signer,
    recorder: signer || drafter ? null : recorder,
  };
}

function EventRow({ event }) {
  const item = describeEvent(event);
  const label = item.words ?? (item.entityId ? shortId(item.entityId) : null);
  const titleClass = item.words ? 'ref-row__title [overflow-wrap:anywhere]' : 'block font-mono text-sm text-muted-foreground [overflow-wrap:anywhere]';
  return (
    <li className="ref-row">
      <p className="text-sm text-muted-foreground">{item.action}</p>
      <div className="min-w-0">
        {label && item.href ? (
          <Link className={`${titleClass} hover:underline`} href={item.href}>{label}</Link>
        ) : label ? (
          <p className={titleClass}>{label}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No object named</p>
        )}
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          {item.entityType ? <span>{sentenceCase(item.entityType)}</span> : null}
          {item.drafter ? <><span aria-hidden="true">·</span><span>Drafted by</span><ActorName actorId={item.drafter} showOwner={false} /></> : null}
          {item.signer ? <><span aria-hidden="true">·</span><span>signed by</span><ActorName actorId={item.signer} showOwner={false} /></> : null}
          {item.recorder ? <><span aria-hidden="true">·</span><span>recorded by</span><ActorName actorId={item.recorder} showOwner={false} /></> : null}
        </p>
      </div>
      <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={event.createdAt}>{dateLabel(event.createdAt)}</time>
    </li>
  );
}

function TaskRow({ task }) {
  return (
    <li className="ref-row">
      <div><StatusBadge state={task.state ?? 'open'} /></div>
      <div className="min-w-0">
        {task.title ? (
          <Link className="ref-row__title [overflow-wrap:anywhere] hover:underline" href={`/tasks/${task.taskId}`}>{task.title}</Link>
        ) : (
          <Link className="block font-mono text-sm text-muted-foreground hover:text-foreground hover:underline" href={`/tasks/${task.taskId}`} title={task.taskId}>{shortId(task.taskId)}</Link>
        )}
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          {task.title ? <span className="font-mono" title={task.taskId}>{shortId(task.taskId)}</span> : null}
          {task.projectId ? <>{task.title ? <span aria-hidden="true">·</span> : null}<Link className="font-mono hover:text-foreground hover:underline" href={`/projects/${encodeURIComponent(task.projectId)}`} title={task.projectId}>{shortId(task.projectId)}</Link></> : null}
          {task.createdBy ? <><span aria-hidden="true">·</span><span>Drafted by</span><ActorName actorId={task.createdBy} showOwner={false} /></> : null}
        </p>
      </div>
      <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={task.createdAt}>{dateLabel(task.createdAt)}</time>
    </li>
  );
}

export default async function WorkPage() {
  const [taskRows, claimRows, events] = await Promise.all([
    readList('/tasks?status=open&limit=12'),
    readList('/claims?status=under_verification&limit=8'),
    readList('/events?limit=12&order=desc'),
  ]);
  const [tasks, claims] = await Promise.all([
    Promise.all(taskRows.map(hydrateTask)),
    Promise.all(claimRows.map(hydrateClaim)),
  ]);
  return (
    <PageContainer wide>
      <PageHeader
        action={<Link className={buttonLinkVariants({ variant: 'outline', size: 'sm' })} href="/agent">Open Agent handoff</Link>}
        title="Work"
      />

      <div className="doc-grid mt-8">
        <section aria-labelledby="open-work-heading" className="doc-main">
          <SectionHeader action={<Link className="text-primary hover:underline" href="/tasks">All tasks</Link>} id="open-work-heading" title="Open tasks" />
          {tasks.length > 0 ? (
            <ul>{tasks.map((task) => <TaskRow key={task.taskId} task={task} />)}</ul>
          ) : <p className="border-b border-border py-5 text-sm font-medium">No open tasks</p>}
        </section>

        <aside aria-label="Verification" className="doc-margin">
          <MarginSection title="Claims in review">
            {claims.length > 0 ? (
              <ul>
                {claims.map((claim) => (
                  <li className="border-b border-border py-3" key={claim.claimId}>
                    <StatusBadge state={claim.state} />
                    {claim.title ?? claim.statement ? (
                      <>
                        <Link className="mt-1.5 block font-serif text-[0.9375rem] leading-snug [overflow-wrap:anywhere] hover:underline" href={`/claims/${claim.claimId}`}>{claim.title ?? claim.statement}</Link>
                        <p className="mt-1 font-mono text-xs text-muted-foreground" title={claim.claimId}>{shortId(claim.claimId)}</p>
                      </>
                    ) : (
                      <Link className="mt-1.5 block font-mono text-xs text-muted-foreground hover:text-foreground hover:underline" href={`/claims/${claim.claimId}`} title={claim.claimId}>{shortId(claim.claimId)}</Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">None in review</p>}
            <Link className="mt-3 inline-block text-sm text-primary hover:underline" href="/verification">Verification</Link>
          </MarginSection>
        </aside>
      </div>

      <section aria-labelledby="event-record-heading" className="mt-8">
        <SectionHeader action={<Link className="text-primary hover:underline" href="/events">Event audit</Link>} id="event-record-heading" title="Recent attributable changes" />
        {events.length > 0 ? (
          <ul>
            {events.map((event) => <EventRow event={event} key={event.eventId} />)}
          </ul>
        ) : <p className="border-b border-border py-5 text-sm font-medium">No recent events</p>}
      </section>
    </PageContainer>
  );
}
