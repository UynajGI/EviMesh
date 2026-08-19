'use client';

import { useEffect, useState } from 'react';
import { IdChip } from '@/components/ui/idchip';
import { StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import Link from 'next/link';

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

/*
 * Signed-in Home (M13.8 05-core-ui-spec.md §2). Sections are grouped by
 * attention level; statuses are text-first badges; ids are copyable chips.
 * Until per-user watchlists exist, this is the honest live view of open
 * research, and the tiers below express attention priority, never truth.
 */
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
    <PageContainer>
      <PageHeader
        action={(
          <Link className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted" href="/work">
            Go to Work
          </Link>
        )}
        description="Live activity across open research. Sections express attention priority, never the truth of a claim."
        eyebrow="Home"
        title="What changed in research"
      />
      {error ? <ErrorState className="mt-10" message={error} onRetry={load} /> : null}
      <section className="mt-14" aria-labelledby="open-questions-heading">
        <SectionHeader action={<span className="text-sm text-muted-foreground">Newest activity first</span>} title="Open questions" />
        {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : questions.length === 0 ? <Empty className="mt-6" title="No open questions yet" description="Questions that are open for research will appear here." /> : <div className="mt-6 grid gap-4 md:grid-cols-2">{questions.map((question) => (
          <article className="rounded-lg border border-border bg-card p-5" key={question.questionId}>
            <div className="flex items-center justify-between gap-3">
              <StatusBadge state={question.state} />
              <time className="text-xs tabular-nums text-muted-foreground" dateTime={question.createdAt}>{relativeTime(question.createdAt)}</time>
            </div>
            <h3 className="mt-4 font-medium"><Link className="hover:underline" href={`/questions/${question.questionId}`}><IdChip className="mt-1" value={question.questionId} /></Link></h3>
            <p className="mt-2 text-sm text-muted-foreground">Project <span className="tabular-nums">{question.projectId}</span></p>
          </article>
        ))}</div>}
      </section>
      <section className="mt-14" aria-labelledby="verification-claims-heading">
        <SectionHeader title="Claims awaiting verification" />
        {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : claims.length === 0 ? <Empty className="mt-6" title="Nothing awaiting verification" description="Claims under verification will appear here as they move through the pipeline." /> : <div className="mt-6 grid gap-4 md:grid-cols-2">{claims.map((claim) => (
          <article className="rounded-lg border border-border bg-card p-5" key={claim.claimId}>
            <StatusBadge state={claim.state} />
            <h3 className="mt-4 font-medium"><Link className="hover:underline" href={`/claims/${claim.claimId}`}><IdChip className="mt-1" value={claim.claimId} /></Link></h3>
            <p className="mt-2 text-sm text-muted-foreground">Question <span className="tabular-nums">{claim.questionId ?? 'not linked'}</span></p>
          </article>
        ))}</div>}
      </section>
      <section className="mt-14" aria-labelledby="frontier-heading">
        <SectionHeader title="Latest frontiers" />
        {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : frontiers.length === 0 ? <Empty className="mt-6" title="No published frontiers yet" description="Frontier snapshots will appear here once projects publish their first." /> : <div className="mt-6 grid gap-4 md:grid-cols-2">{frontiers.map(({ project, frontier }) => (
          <article className="rounded-lg border border-border bg-card p-5" key={frontier.snapshotId}>
            <p className="text-sm text-muted-foreground">Project <Link className="tabular-nums hover:underline" href={`/projects/${project.projectId}`}>{project.projectId}</Link></p>
            <h3 className="mt-3 text-lg font-medium tabular-nums">Frontier #{frontier.sequence}</h3>
            <p className="mt-2"><IdChip value={frontier.snapshotId} /></p>
          </article>
        ))}</div>}
      </section>
      <section className="mt-14" aria-labelledby="newcomer-tasks-heading">
        <SectionHeader title="Newcomer tasks" />
        {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : tasks.length === 0 ? <Empty className="mt-6" title="No newcomer tasks open" description="CPU-only and under-60-minute tasks will appear here when available." /> : <div className="mt-6 grid gap-4 md:grid-cols-2">{tasks.map((task) => (
          <article className="rounded-lg border border-border bg-card p-5" key={`${task.taskId}-${task.tag}`}>
            <span className="inline-flex items-center rounded-full border border-status-neutral-border bg-status-neutral-bg px-2.5 py-0.5 text-xs font-medium text-status-neutral-fg">{task.tag}</span>
            <h3 className="mt-4 font-medium"><Link className="hover:underline" href={`/tasks/${task.taskId}`}><IdChip className="mt-1" value={task.taskId} /></Link></h3>
            <p className="mt-2 text-sm text-muted-foreground">Open in project <span className="tabular-nums">{task.projectId ?? 'not assigned'}</span></p>
          </article>
        ))}</div>}
      </section>
    </PageContainer>
  );
}
