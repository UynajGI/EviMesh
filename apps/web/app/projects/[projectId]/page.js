'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { FrontierTimeline } from '@/components/frontier-timeline';
import { ProjectEventStream } from '@/components/project-event-stream';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const TABS = ['Overview', 'Questions', 'Tasks', 'Claims', 'Frontier', 'Activity'];

function stateVariant(state) {
  switch (state) {
    case 'active': return 'success';
    case 'archived': return 'default';
    default: return 'default';
  }
}

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Project data is unavailable.');
  return payload;
}

export default function ProjectDetailPage({ params }) {
  const [projectId, setProjectId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('Overview');

  useEffect(() => { Promise.resolve(params).then(({ projectId: value }) => setProjectId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const [project, questions, tasks, claims, frontier] = await Promise.all([
        request(`/projects/${projectId}`),
        request(`/questions?projectId=${projectId}&limit=6`),
        request(`/tasks?projectId=${projectId}&limit=6`),
        request(`/claims?projectId=${projectId}&limit=6`),
        request(`/projects/${projectId}/frontier/latest`),
      ]);
      setData({ project, questions: questions.items ?? [], tasks: tasks.items ?? [], claims: claims.items ?? [], frontier: frontier.frontier });
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (projectId) load(); }, [projectId]);

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;

  const { project, questions, tasks, claims, frontier } = data;
  const { project: identity, currentRevision } = project;
  const tabButton = (name) => <button type="button" aria-pressed={tab === name} onClick={() => setTab(name)} className={tab === name ? 'border-b-2 border-primary px-1 pb-2 text-sm font-medium text-foreground' : 'border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-muted-foreground transition hover:text-foreground'}>{name}</button>;
  const linkedList = (items, idKey, hrefFor, stateText) => items.length === 0 ? <Empty className="mt-6" title="Nothing here yet" description="Items will appear here as the project grows." /> : <ul className="mt-6 grid gap-4 md:grid-cols-2">{items.map((item) => <li key={item[idKey]}><Link className="block rounded-lg border border-border bg-card p-4 transition hover:border-primary" href={hrefFor(item)}><span className="text-sm font-medium tabular-nums">{item[idKey]}</span><span className="mt-2 block text-xs text-muted-foreground">{stateText(item)}</span></Link></li>)}</ul>;

  return (
    <PageContainer>
      <PageHeader eyebrow={identity.state.replaceAll('_', ' ')} title={currentRevision.name} description={currentRevision.summary} />
      <div className="mt-10 flex gap-6 overflow-x-auto border-b border-border pb-1" role="tablist" aria-label="Project sections">{TABS.map(tabButton)}</div>
      {tab === 'Overview' && <section className="mt-8" aria-labelledby="overview-heading"><h2 id="overview-heading" className="text-lg font-semibold">Overview</h2><dl className="mt-4 divide-y divide-border rounded-lg border border-border bg-card"><div className="flex items-center justify-between gap-4 px-5 py-3"><dt className="text-sm text-muted-foreground">Project ID</dt><dd className="text-sm tabular-nums">{identity.projectId}</dd></div><div className="flex items-center justify-between gap-4 px-5 py-3"><dt className="text-sm text-muted-foreground">Status</dt><dd><Badge variant={stateVariant(identity.state)}>{identity.state.replaceAll('_', ' ')}</Badge></dd></div></dl></section>}
      {tab === 'Questions' && <section className="mt-8" aria-labelledby="questions-heading"><h2 id="questions-heading" className="text-lg font-semibold">Questions</h2>{linkedList(questions, 'questionId', (item) => `/questions/${item.questionId}`, (item) => `Question · ${item.state.replaceAll('_', ' ')}`)}</section>}
      {tab === 'Tasks' && <section className="mt-8" aria-labelledby="tasks-heading"><h2 id="tasks-heading" className="text-lg font-semibold">Tasks</h2>{linkedList(tasks, 'taskId', (item) => `/tasks/${item.taskId}`, (item) => `Task · ${item.status ?? item.state ?? 'unknown'}`)}</section>}
      {tab === 'Claims' && <section className="mt-8" aria-labelledby="claims-heading"><h2 id="claims-heading" className="text-lg font-semibold">Claims</h2>{linkedList(claims, 'claimId', (item) => `/claims/${item.claimId}`, (item) => `Claim · ${(item.status ?? item.state ?? 'unknown').replaceAll('_', ' ')}`)}</section>}
      {tab === 'Frontier' && <section className="mt-8" aria-labelledby="frontier-heading"><h2 id="frontier-heading" className="text-lg font-semibold">Latest frontier</h2>{frontier ? <p className="mt-4 rounded-lg border border-border bg-card p-4 text-sm tabular-nums">Frontier #{frontier.sequence} · {frontier.snapshotId}</p> : <Empty className="mt-4" title="No frontier published yet" description="Frontier snapshots will appear here once the project publishes its first." />}<FrontierTimeline projectId={projectId} /></section>}
      {tab === 'Activity' && <section className="mt-8" aria-labelledby="activity-heading"><h2 id="activity-heading" className="text-lg font-semibold">Activity</h2><ProjectEventStream projectId={projectId} /></section>}
    </PageContainer>
  );
}
