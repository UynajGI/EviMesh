'use client';

import { useEffect, useState } from 'react';
import { FrontierTimeline } from '@/components/frontier-timeline';
import { ProjectEventStream } from '@/components/project-event-stream';

async function request(path) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Project data is unavailable.');
  return payload;
}

export default function ProjectDetailPage({ params }) {
  const [projectId, setProjectId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ projectId: value }) => setProjectId(value)); }, [params]);
  useEffect(() => {
    if (!projectId) return;
    Promise.all([request(`/projects/${projectId}`), request(`/questions?projectId=${projectId}&limit=6`), request(`/tasks?projectId=${projectId}&limit=6`), request(`/projects/${projectId}/frontier/latest`)]).then(([project, questions, tasks, frontier]) => setData({ project, questions: questions.items ?? [], tasks: tasks.items ?? [], frontier: frontier.frontier })).catch((reason) => setError(reason.message));
  }, [projectId]);
  if (error) return <main className="mx-auto max-w-5xl px-6 py-16"><p className="text-sm text-muted-foreground">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-5xl px-6 py-16" aria-busy="true">Loading project…</main>;
  const { project, questions, tasks, frontier } = data;
  return <main className="mx-auto max-w-5xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">{project.project.state}</p><h1 className="mt-3 text-4xl font-semibold">{project.currentRevision.name}</h1><p className="mt-4 max-w-3xl text-muted-foreground">{project.currentRevision.summary}</p><section className="mt-12"><h2 className="text-2xl font-semibold">Questions</h2><ul className="mt-4 space-y-3">{questions.map((question) => <li className="rounded border border-border p-4" key={question.questionId}>{question.questionId} <span className="text-muted-foreground">{question.state}</span></li>)}</ul></section><section className="mt-12"><h2 className="text-2xl font-semibold">Latest frontier</h2><p className="mt-4 rounded border border-border p-4">{frontier ? `Frontier #${frontier.sequence}` : 'No frontier published yet.'}</p></section><FrontierTimeline projectId={projectId} /><ProjectEventStream projectId={projectId} /><section className="mt-12"><h2 className="text-2xl font-semibold">Tasks</h2><ul className="mt-4 space-y-3">{tasks.map((task) => <li className="rounded border border-border p-4" key={task.taskId}>{task.taskId} <span className="text-muted-foreground">{task.status}</span></li>)}</ul></section></main>;
}
