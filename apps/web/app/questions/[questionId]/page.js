'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? 'Question data is unavailable.');
  return body;
}

function stateVariant(state) {
  switch (state) {
    case 'active':
    case 'admissible': return 'success';
    case 'under_review': return 'warning';
    case 'resolved': return 'info';
    case 'rejected':
    case 'archived': return 'destructive';
    default: return 'default';
  }
}

export default function QuestionDetailPage({ params }) {
  const [questionId, setQuestionId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { Promise.resolve(params).then(({ questionId: value }) => setQuestionId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const question = await request(`/questions/${questionId}`);
      const [tasks, frontier] = await Promise.all([
        request(`/tasks?projectId=${question.question.projectId}&limit=6`).then((body) => body.items ?? []),
        request(`/projects/${question.question.projectId}/frontier/latest`).then((body) => body.frontier ?? null).catch(() => null),
      ]);
      setData({ ...question, tasks, frontier });
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (questionId) load(); }, [questionId]);

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;

  const { question, currentRevision, contract, tasks, frontier } = data;
  return (
    <PageContainer>
      <PageHeader eyebrow={`Question · ${question.state.replaceAll('_', ' ')}`} title={currentRevision.title} description={currentRevision.statement} action={<Link className="text-sm font-medium text-primary" href="/questions">← All questions</Link>} />
      <dl className="mt-10 divide-y divide-border rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-4 px-5 py-3"><dt className="text-sm text-muted-foreground">Question ID</dt><dd className="text-sm tabular-nums">{question.questionId}</dd></div>
        <div className="flex items-center justify-between gap-4 px-5 py-3"><dt className="text-sm text-muted-foreground">Status</dt><dd><Badge variant={stateVariant(question.state)}>{question.state.replaceAll('_', ' ')}</Badge></dd></div>
        <div className="flex items-center justify-between gap-4 px-5 py-3"><dt className="text-sm text-muted-foreground">Revision</dt><dd className="text-sm tabular-nums">r{currentRevision.revision ?? 1}</dd></div>
        <div className="flex items-center justify-between gap-4 px-5 py-3"><dt className="text-sm text-muted-foreground">Project</dt><dd className="text-sm tabular-nums"><Link className="text-primary hover:underline" href={`/projects/${question.projectId}`}>{question.projectId}</Link></dd></div>
      </dl>
      <section className="mt-10" aria-labelledby="contract-heading">
        <h2 id="contract-heading" className="text-lg font-semibold">Research Contract</h2>
        <div className="mt-4 rounded-lg border border-border bg-card p-5"><p className="font-medium">{contract.title ?? contract.contractId}</p><p className="mt-1 text-sm tabular-nums text-muted-foreground">{contract.contractId} · revision {contract.revision}</p></div>
      </section>
      <section className="mt-10" aria-labelledby="frontier-heading">
        <h2 id="frontier-heading" className="text-lg font-semibold">Frontier</h2>
        {frontier ? <p className="mt-4 rounded-lg border border-border bg-card p-5 text-sm tabular-nums">Frontier #{frontier.sequence} · {frontier.snapshotId}</p> : <Empty className="mt-4" title="No frontier published yet" description="The project's frontier snapshots will appear here once published." />}
      </section>
      <section className="mt-10" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" className="text-lg font-semibold">Tasks</h2>
        {tasks.length === 0 ? <Empty className="mt-4" title="No tasks attached" description="Tasks for this question will appear here when opened." /> : <ul className="mt-4 grid gap-4 md:grid-cols-2">{tasks.map((task) => <li key={task.taskId}><Link className="block rounded-lg border border-border bg-card p-4 transition hover:border-primary" href={`/tasks/${task.taskId}`}><span className="text-sm font-medium tabular-nums">{task.taskId}</span><span className="mt-2 block text-xs text-muted-foreground">Task · {task.status ?? task.state ?? 'unknown'}</span></Link></li>)}</ul>}
      </section>
    </PageContainer>
  );
}
