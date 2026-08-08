'use client';

import { useEffect, useState } from 'react';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';

const CLOSED_STATES = new Set(['resolved', 'archived', 'rejected']);

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Activity time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HomePage() {
  const [questions, setQuestions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [frontiers, setFrontiers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [questionItems, taskGroups, projectItems, claimGroups] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/questions?limit=20`).then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message ?? 'Questions are unavailable.');
          return payload.items ?? [];
        }),
        Promise.all(['cpu-only', 'under-60-min'].map((tag) => fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/tasks?status=open&tag=${tag}&limit=6`).then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message ?? 'Tasks are unavailable.');
          return (payload.items ?? []).map((task) => ({ ...task, tag }));
        }))),
        fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/projects?limit=6`).then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message ?? 'Projects are unavailable.');
          return payload.items ?? [];
        }).then((projects) => Promise.all(projects.map(async (project) => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/projects/${project.projectId}/frontier/latest`);
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message ?? 'Frontiers are unavailable.');
          return payload.frontier ? { project, frontier: payload.frontier } : null;
        }))),
        Promise.all(['under_verification', 'provisionally_accepted'].map((status) => fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/claims?status=${status}&limit=6`).then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.message ?? 'Claims are unavailable.');
          return payload.items ?? [];
        }))),
      ]);
      setQuestions(questionItems.filter((question) => !CLOSED_STATES.has(question.state)).sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0)).slice(0, 6));
      setTasks(taskGroups.flat().slice(0, 6));
      setFrontiers(projectItems.filter(Boolean));
      setClaims(claimGroups.flat().sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0)).slice(0, 6));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-20 text-foreground">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">EviMesh</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Open distributed scientific network.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">A transparent workspace for research questions, evidence, verification, and shared scientific progress.</p>
      {error ? <ErrorState className="mt-10" message={error} onRetry={load} /> : null}
      <section className="mt-16" aria-labelledby="open-questions-heading">
        <div className="flex items-baseline justify-between gap-6"><div><p className="text-sm font-medium text-secondary-foreground">Research now</p><h2 id="open-questions-heading" className="mt-2 text-2xl font-semibold tracking-tight">Open questions</h2></div><span className="text-sm text-muted-foreground">Newest activity first</span></div>
        {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : questions.length === 0 ? <Empty className="mt-6" title="No open questions yet" description="Questions that are open for research will appear here." /> : <div className="mt-6 grid gap-4 md:grid-cols-2">{questions.map((question) => <article className="rounded-lg border border-border bg-card p-5" key={question.questionId}><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">{question.state}</span><time className="text-xs tabular-nums text-muted-foreground" dateTime={question.createdAt}>{relativeTime(question.createdAt)}</time></div><h3 className="mt-4 font-medium tabular-nums">{question.questionId}</h3><p className="mt-2 text-sm text-muted-foreground">Project <span className="tabular-nums">{question.projectId}</span></p></article>)}</div>}
      </section>
      <section className="mt-16" aria-labelledby="verification-claims-heading">
        <div><p className="text-sm font-medium text-secondary-foreground">Evidence in motion</p><h2 id="verification-claims-heading" className="mt-2 text-2xl font-semibold tracking-tight">Claims awaiting verification</h2></div>
        {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : claims.length === 0 ? <Empty className="mt-6" title="Nothing awaiting verification" description="Claims under verification will appear here as they move through the pipeline." /> : <div className="mt-6 grid gap-4 md:grid-cols-2">{claims.map((claim) => <article className="rounded-lg border border-border bg-card p-5" key={claim.claimId}><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">{claim.state.replaceAll('_', ' ')}</span><h3 className="mt-4 font-medium tabular-nums">{claim.claimId}</h3><p className="mt-2 text-sm text-muted-foreground">Question <span className="tabular-nums">{claim.questionId ?? 'not linked'}</span></p></article>)}</div>}
      </section>
      <section className="mt-16" aria-labelledby="frontier-heading">
        <div><p className="text-sm font-medium text-secondary-foreground">Established knowledge</p><h2 id="frontier-heading" className="mt-2 text-2xl font-semibold tracking-tight">Latest frontiers</h2></div>
        {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : frontiers.length === 0 ? <Empty className="mt-6" title="No published frontiers yet" description="Frontier snapshots will appear here once projects publish their first." /> : <div className="mt-6 grid gap-4 md:grid-cols-2">{frontiers.map(({ project, frontier }) => <article className="rounded-lg border border-border bg-card p-5" key={frontier.snapshotId}><p className="text-sm text-muted-foreground">Project <span className="tabular-nums">{project.projectId}</span></p><h3 className="mt-3 text-lg font-medium tabular-nums">Frontier #{frontier.sequence}</h3><p className="mt-2 text-sm tabular-nums text-muted-foreground">Snapshot {frontier.snapshotId}</p></article>)}</div>}
      </section>
      <section className="mt-16" aria-labelledby="newcomer-tasks-heading">
        <div><p className="text-sm font-medium text-secondary-foreground">Contribute today</p><h2 id="newcomer-tasks-heading" className="mt-2 text-2xl font-semibold tracking-tight">Newcomer tasks</h2></div>
        {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : tasks.length === 0 ? <Empty className="mt-6" title="No newcomer tasks open" description="CPU-only and under-60-minute tasks will appear here when available." /> : <div className="mt-6 grid gap-4 md:grid-cols-2">{tasks.map((task) => <article className="rounded-lg border border-border bg-card p-5" key={`${task.taskId}-${task.tag}`}><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{task.tag}</span><h3 className="mt-4 font-medium tabular-nums">{task.taskId}</h3><p className="mt-2 text-sm text-muted-foreground">Open in project <span className="tabular-nums">{task.projectId ?? 'not assigned'}</span></p></article>)}</div>}
      </section>
    </main>
  );
}
