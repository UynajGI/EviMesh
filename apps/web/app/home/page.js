'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Activity, Bot, ListFilter, ListTodo } from 'lucide-react';
import { ChangeGroup, ChangeItem } from '@/components/change-item';
import { StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';

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
 * Signed-in Home (design book 05 §2): an awareness stream grouped by
 * attention level (icon + tone first, what / why / basis after), with a
 * context rail. Until per-user watchlists exist this is the honest live view;
 * levels express attention priority, never the truth of a claim.
 */
export default function HomePage() {
  const [questions, setQuestions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [frontiers, setFrontiers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [windowStart, setWindowStart] = useState(null);
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
  /* Observation window derives from live time (client), not a frozen string. */
  useEffect(() => {
    setWindowStart(new Date(Date.now() - 7 * 24 * 60 * 60_000));
  }, []);

  const inWindow = (value) => windowStart === null || !value || Date.parse(value) >= windowStart.getTime();
  const visibleQuestions = questions.filter((q) => inWindow(q.createdAt));
  const visibleClaims = claims.filter((c) => inWindow(c.createdAt));
  const visibleFrontiers = frontiers.filter((f) => inWindow(f.frontier.createdAt));
  const visibleTasks = tasks.filter((t) => inWindow(t.createdAt));

  const rail = [
    {
      icon: ListTodo,
      title: 'My work',
      href: '/work',
      cta: 'Go to Work',
      rows: [
        { label: 'Claims awaiting your verification', count: visibleClaims.length, badge: 'accent' },
        { label: 'Open tasks to pick up', count: visibleTasks.length, badge: 'neutral' },
        { label: 'Frontiers published', count: visibleFrontiers.length, badge: 'neutral' },
      ],
    },
    { icon: Bot, title: 'Agent connection', body: 'Six steps from hearing about EviMesh to a first trusted read.', href: '/agent', cta: 'Open the center' },
    { icon: Activity, title: 'Event audit', body: 'Signed research history with hashes, one layer down.', href: '/events', cta: 'Open audit' },
  ];

  return (
    <PageContainer wide>
      <PageHeader
        action={(
          <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted" href="/notifications">
            <ListFilter aria-hidden="true" size={14} />
            Manage subscriptions
          </Link>
        )}
        description={windowStart === null ? 'Live activity across open research, grouped by attention level; levels express attention priority, never the truth of a claim.' : `Observation window: last 7 days (since ${windowStart.toISOString().slice(0, 10)}), filtered to activity inside it. Levels express attention priority, never the truth of a claim.`}
        eyebrow="Home"
        title="What changed in research"
      />
      {error ? <ErrorState className="mt-10" message={error} onRetry={load} /> : null}

      <div className="mt-2 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0">
          <ChangeGroup count={visibleClaims.length} level="attention" title="Claims awaiting verification">
            {loading ? <Skeleton className="h-32 w-full" /> : error ? null : claims.length === 0 ? <Empty title="Nothing awaiting verification" description="Claims under verification will appear here as they move through the pipeline." /> : (
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {visibleClaims.map((claim) => (
                  <ChangeItem
                    href={`/claims/${claim.claimId}`}
                    id={claim.claimId}
                    idLabel="claim"
                    key={claim.claimId}
                    level="attention"
                    meta={<StatusBadge state={claim.state} />}
                    time={relativeTime(claim.createdAt)}
                    what="Claim moving through verification"
                    why="Receipts record outcomes, independence, and findings. Open the claim to see the exact revision, evidence groups, and any unresolved finding."
                  />
                ))}
              </div>
            )}
          </ChangeGroup>

          <ChangeGroup count={visibleQuestions.length} level="update" meta="Newest activity first" title="Open questions">
            {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : questions.length === 0 ? <Empty title="No open questions yet" description="Questions that are open for research will appear here." /> : (
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {visibleQuestions.map((question) => (
                  <ChangeItem
                    href={`/questions/${question.questionId}`}
                    id={question.questionId}
                    idLabel="question"
                    key={question.questionId}
                    level="update"
                    meta={<StatusBadge state={question.state} />}
                    time={relativeTime(question.createdAt)}
                    what="Open question seeking answers"
                    why="Each question carries its research contract, frontier membership, and claim graph in the six-view workspace."
                  />
                ))}
              </div>
            )}
          </ChangeGroup>

          <ChangeGroup count={visibleFrontiers.length} level="frontier" title="Latest frontiers">
            {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : frontiers.length === 0 ? <Empty title="No published frontiers yet" description="Frontier snapshots will appear here once projects publish their first." /> : (
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {visibleFrontiers.map(({ project, frontier }) => (
                  <ChangeItem
                    href={`/projects/${project.projectId}`}
                    id={frontier.snapshotId}
                    idLabel="snapshot"
                    key={frontier.snapshotId}
                    level="frontier"
                    meta={<span className="text-sm font-medium tabular-nums">Frontier #{frontier.sequence}</span>}
                    time={relativeTime(frontier.createdAt)}
                    what="Frontier snapshot published"
                    why="Snapshots are immutable: the member set is frozen at publication and stays linkable forever."
                  />
                ))}
              </div>
            )}
          </ChangeGroup>

          <ChangeGroup count={visibleTasks.length} level="task" title="Newcomer tasks">
            {loading ? <Skeleton className="mt-6 h-32 w-full" /> : error ? null : tasks.length === 0 ? <Empty title="No newcomer tasks open" description="CPU-only and under-60-minute tasks will appear here when available." /> : (
              <div className="divide-y divide-border rounded-lg border border-border bg-card">
                {visibleTasks.map((task) => (
                  <ChangeItem
                    href={`/tasks/${task.taskId}`}
                    id={task.taskId}
                    idLabel="task"
                    key={`${task.taskId}-${task.tag}`}
                    level="task"
                    meta={<span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{task.tag}</span>}
                    time={relativeTime(task.createdAt)}
                    what="Open task to pick up"
                    why="CPU-only and under-60-minute work suitable for a first attempt."
                  />
                ))}
              </div>
            )}
          </ChangeGroup>
        </div>

        <aside aria-label="Context" className="grid gap-3">
          {rail.map(({ icon: Icon, title, body, rows, href, cta }) => (
            <div className="rounded-lg border border-border bg-card p-4" key={title}>
              <div className="flex items-center gap-2">
                <Icon aria-hidden="true" className="text-muted-foreground" size={16} />
                <h2 className="text-sm font-semibold">{title}</h2>
              </div>
              {rows ? (
                <ul className="mt-3 grid gap-2">
                  {rows.map((row) => (
                    <li className="flex items-center justify-between gap-2 text-xs" key={row.label}>
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium tabular-nums text-muted-foreground">{row.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{body}</p>
              )}
              <Link className="mt-3 inline-block text-xs font-medium text-primary hover:underline" href={href}>{cta} →</Link>
            </div>
          ))}
        </aside>
      </div>
    </PageContainer>
  );
}
