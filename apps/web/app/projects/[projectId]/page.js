'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { ActorName, Identifier, MarginSection, formatDate, shortId } from '@/components/ui/doc';
import { FrontierTimeline } from '@/components/frontier-timeline';
import { ProjectEventStream } from '@/components/project-event-stream';
import { ProjectMembers } from '@/components/project-members';
import { useVisitRecord } from '@/lib/visit-history';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const TABS = ['Overview', 'Questions', 'Tasks', 'Claims', 'Frontier', 'Members', 'Activity'];

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Project data is unavailable.');
  return payload;
}

function readable(value) {
  return String(value ?? 'unknown').replaceAll('_', ' ');
}

/* Statements and titles are hydrated per row: list endpoints carry ids and
 * states only, so the row reads the current revision for its words. */
function useTitles(kind, items, idKey) {
  const [titles, setTitles] = useState({});
  const ids = items.map((item) => item[idKey]).join('|');
  useEffect(() => {
    if (!ids) return undefined;
    let cancelled = false;
    Promise.all(ids.split('|').map(async (id) => {
      try {
        const body = await request(`/${kind}/${id}`);
        const revision = body.currentRevision ?? {};
        return [id, revision.title ?? revision.statement ?? revision.name ?? null];
      } catch { return [id, null]; }
    })).then((entries) => { if (!cancelled) setTitles(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [kind, ids]);
  return titles;
}

function ObjectRows({ items, idKey, kind, hrefPrefix, empty, serif = false }) {
  const titles = useTitles(kind, items, idKey);
  if (items.length === 0) return <Empty className="border-t-0" title={empty} />;
  return (
    <ul>
      {items.map((item) => (
        <li className="ref-row" key={item[idKey]}>
          <div><StatusBadge state={item.state ?? item.status} /></div>
          <div className="min-w-0">
            <Link className={cn('hover:underline', serif ? 'ref-row__title' : 'text-base font-medium')} href={`${hrefPrefix}/${item[idKey]}`}>{titles[item[idKey]] ?? <span className="font-mono text-sm" title={item[idKey]}>{shortId(item[idKey])}</span>}</Link>
            {item.createdBy ? <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">Drafted by <ActorName actorId={item.createdBy} showOwner={false} /></p> : null}
          </div>
          <p className="text-xs tabular-nums text-muted-foreground md:text-right">{formatDate(item.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}

function SectionHead({ id, title, count }) {
  return <SectionHeader action={count !== undefined ? <span className="tabular-nums text-muted-foreground">{count}</span> : null} id={id} title={title} />;
}

/*
 * Project workspace: a document head, then sections switched in place. The
 * Members section carries the governance surface (roster, Agent enrollment,
 * invitations) without leaving the project.
 */
export default function ProjectDetailPage({ params }) {
  const [projectId, setProjectId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('Overview');

  useEffect(() => { Promise.resolve(params).then(({ projectId: value }) => setProjectId(value)); }, [params]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    const match = TABS.find((name) => name.toLowerCase() === hash);
    if (match) setTab(match);
  }, []);

  async function load() {
    setError(null);
    try {
      const [project, questions, tasks, claims, frontier] = await Promise.all([
        request(`/projects/${projectId}`),
        request(`/questions?projectId=${projectId}&limit=20`),
        request(`/tasks?projectId=${projectId}&limit=20`),
        request(`/claims?projectId=${projectId}&limit=20`),
        request(`/projects/${projectId}/frontier/latest`).catch(() => ({ frontier: null })),
      ]);
      setData({ project, questions: questions.items ?? [], tasks: tasks.items ?? [], claims: claims.items ?? [], frontier: frontier.frontier });
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (projectId) load(); }, [projectId]);
  /* Local recently-visited rail on Home records this page once its name is known. */
  useVisitRecord({ href: projectId ? `/projects/${projectId}` : null, label: data?.project?.currentRevision?.name ?? null, kind: 'project' });

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;

  const { project, questions, tasks, claims, frontier } = data;
  const { project: identity, currentRevision } = project;
  const counts = { Questions: questions.length, Tasks: tasks.length, Claims: claims.length };
  const selectTab = (name) => {
    setTab(name);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${name.toLowerCase()}`);
  };
  const tabButton = (name) => (
    <button
      aria-pressed={tab === name}
      className={cn(
        'relative -mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-1 text-sm font-medium transition-colors',
        tab === name ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
      key={name}
      onClick={() => selectTab(name)}
      type="button"
    >
      {name}{counts[name] !== undefined ? <span className="tabular-nums text-muted-foreground">{counts[name]}</span> : null}
    </button>
  );

  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Projects', href: '/projects' }, { label: currentRevision.name }]} />
      <PageHeader title={currentRevision.name} />
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><StatusBadge state={identity.state === 'active' ? 'active_question' : identity.state} label={readable(identity.state)} /><span>Project</span>{currentRevision.license ?? identity.license ? <><span aria-hidden="true">·</span><span>{currentRevision.license ?? identity.license}</span></> : null}</p>
      {currentRevision.summary ? <p className="mt-3 max-w-[68ch] font-serif text-base leading-7">{currentRevision.summary}</p> : null}

      <nav aria-label="Project sections" className="mt-6 flex gap-6 overflow-x-auto border-b border-border">{TABS.map(tabButton)}</nav>

      <div className="doc-grid mt-8">
        <div className="min-w-0">
          {tab === 'Overview' && (
            <section aria-labelledby="overview-heading">
              <SectionHead id="overview-heading" title="Overview" />
              <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Project ID</dt><dd><Identifier value={identity.projectId} /></dd>
                <dt className="text-muted-foreground">Status</dt><dd>{readable(identity.state)}</dd>
                <dt className="text-muted-foreground">License</dt><dd>{currentRevision.license ?? identity.license ?? 'not stated'}</dd>
                <dt className="text-muted-foreground">Revision</dt><dd className="tabular-nums">r{currentRevision.revision}</dd>
                <dt className="text-muted-foreground">Created</dt><dd className="tabular-nums">{formatDate(identity.createdAt)}</dd>
                <dt className="text-muted-foreground">Latest frontier</dt><dd className="tabular-nums">{frontier ? `Snapshot #${frontier.sequence}` : 'None published yet'}</dd>
              </dl>
              <div className="mt-8">
                <SectionHead id="recent-questions-heading" title="Questions" count={questions.length} />
                <ObjectRows empty="No questions yet" hrefPrefix="/questions" idKey="questionId" items={questions.slice(0, 5)} kind="questions" />
              </div>
            </section>
          )}
          {tab === 'Questions' && <section aria-labelledby="questions-heading"><SectionHead count={questions.length} id="questions-heading" title="Questions" /><ObjectRows empty="No questions yet" hrefPrefix="/questions" idKey="questionId" items={questions} kind="questions" /></section>}
          {tab === 'Tasks' && <section aria-labelledby="tasks-heading"><SectionHead count={tasks.length} id="tasks-heading" title="Tasks" /><ObjectRows empty="No tasks yet" hrefPrefix="/tasks" idKey="taskId" items={tasks} kind="tasks" /></section>}
          {tab === 'Claims' && <section aria-labelledby="claims-heading"><SectionHead count={claims.length} id="claims-heading" title="Claims" /><ObjectRows empty="No claims yet" hrefPrefix="/claims" idKey="claimId" items={claims} kind="claims" serif /></section>}
          {tab === 'Frontier' && (
            <section aria-labelledby="frontier-heading">
              <SectionHead id="frontier-heading" title="Frontier" />
              {frontier ? <p className="mt-3 flex flex-wrap items-baseline gap-2 text-sm tabular-nums">Latest: snapshot #{frontier.sequence} <Identifier value={frontier.snapshotId} /></p> : <Empty className="border-t-0" title="No frontier published yet" />}
              <div className="mt-6"><FrontierTimeline projectId={projectId} /></div>
            </section>
          )}
          {tab === 'Members' && <ProjectMembers projectId={projectId} />}
          {tab === 'Activity' && <section aria-labelledby="activity-heading"><SectionHead id="activity-heading" title="Activity" /><div className="mt-3"><ProjectEventStream projectId={projectId} /></div></section>}
        </div>

        <aside aria-label="Project record" className="doc-margin">
          <MarginSection title="Maintainers">
            <ul className="grid gap-2 text-sm">
              {(currentRevision.maintainerIds ?? []).map((actorId) => <li key={actorId}><ActorName actorId={actorId} showOwner={false} /></li>)}
            </ul>
            <button className="mt-3 text-sm text-primary hover:underline" onClick={() => selectTab('Members')} type="button">All members</button>
          </MarginSection>
          <MarginSection title="Record">
            <ul className="grid gap-1.5 text-sm">
              <li><Link className="text-primary hover:underline" href={`/agent?project=${encodeURIComponent(identity.projectId)}`}>Connect an Agent</Link></li>
              <li><Link className="text-primary hover:underline" href={`/events?projectId=${encodeURIComponent(identity.projectId)}`}>Event audit</Link></li>
            </ul>
          </MarginSection>
        </aside>
      </div>
    </PageContainer>
  );
}
