'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bot, FileCheck2, FlaskConical, GitPullRequestArrow, History, Scale, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { RoleBar, CONTRIBUTION_ROLES } from '@/components/role-bar';
import { HandoffSheet } from '@/components/handoff-sheet';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

const TABS = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'verify', label: 'Verification queue' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'record', label: 'Contribution record' },
];

const CREATE_LINKS = [
  { href: '/questions/new', label: 'New question', icon: GitPullRequestArrow },
  { href: '/claims/new', label: 'New claim', icon: GitPullRequestArrow },
  { href: '/evidence/new', label: 'Add evidence', icon: FlaskConical },
  { href: '/challenges/new', label: 'Raise a challenge', icon: Scale },
  { href: '/runs/new', label: 'Start a run', icon: Activity },
  { href: '/verification/receipt/new', label: 'Record verification', icon: ShieldCheck },
];

/* Task titles live on /tasks/:id (revision table), so hydrate the first
 * WORK_HYDRATE queue rows; the rest keep the id line. */
const WORK_HYDRATE = 8;

async function hydrateTaskTitle(task) {
  try {
    const detail = await fetchJson(`/tasks/${task.taskId}`);
    return detail.currentRevision?.title ?? null;
  } catch {
    return null;
  }
}

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `${path} is unavailable.`);
  return payload;
}

async function fetchList(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `${path} is unavailable.`);
  return payload.items ?? [];
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

/* Contribution-role hint from an event type: deterministic, count-only. */
function roleForEventType(type) {
  const t = type ?? '';
  if (t.startsWith('claim') && (t.includes('created') || t.includes('proposed'))) return 'originator';
  if (t.startsWith('verification') || t.startsWith('receipt')) return 'verifier';
  if (t.startsWith('challenge')) return 'reviewer';
  if (t.startsWith('witness') || t.startsWith('checkpoint')) return 'witness';
  return 'contributor';
}

/*
 * Work (design book 05 §4): the action queue as five tabs — tasks, the
 * verification queue, challenges, drafts, and the contribution record with a
 * count-only role bar. Every write workflow stays one click away.
 */
export default function WorkPage() {
  const [tab, setTab] = useState('tasks');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [rowHandoff, setRowHandoff] = useState(null);
  const [openTasks, setTasks] = useState(null);
  const [verificationClaims, setVerificationClaims] = useState(null);
  const [events, setEvents] = useState(null);
  const [scopedActor, setScopedActor] = useState(null);
  const [error, setError] = useState(null);

  /* Queues load independently: an events outage must not blank the task
   * and verification tabs. The contribution record is scoped to the signed-in
   * actor when a session exists; otherwise it shows the network-wide record
   * with an explicit label. Events paginate ascending, so the newest page is
   * the last one (bounded traversal). */
  async function loadNewestEvents(actorId) {
    const pages = [];
    let cursor = null;
    for (let page = 0; page < 10; page += 1) {
      const query = `/events?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${actorId ? `&actorId=${encodeURIComponent(actorId)}`: ''}`;
      const body = await fetchJson(query);
      pages.push(...(body.items ?? []));
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
    return pages.slice(-60);
  }

  async function load() {
    setError(null);
    fetchList('/tasks?status=open&limit=12')
      .then(async (tasks) => {
        const enriched = await Promise.all(tasks.slice(0, WORK_HYDRATE).map(async (task) => ({ ...task, title: await hydrateTaskTitle(task) })));
        setTasks([...enriched, ...tasks.slice(WORK_HYDRATE)]);
      })
      .catch((reason) => setError(reason.message));
    fetchList('/claims?status=under_verification&limit=10')
      .then(setVerificationClaims)
      .catch((reason) => setError(reason.message));
    (async () => {
      try {
        let actorId = null;
        try {
          const { createBrowserSupabaseClient } = await import('@/lib/supabase-browser');
          const { data } = await createBrowserSupabaseClient().auth.getSession();
          actorId = data.session?.user?.user_metadata?.evimesh_actor_id ?? data.session?.user?.id ?? null;
        } catch { /* anonymous: network-wide record */ }
        setScopedActor(actorId);
        setEvents(await loadNewestEvents(actorId));
      } catch (reason) {
        setError(reason.message);
      }
    })();
  }

  useEffect(() => { load(); }, []);

  const roleCounts = useMemo(() => {
    const counts = Object.fromEntries(CONTRIBUTION_ROLES.map((role) => [role, 0]));
    for (const event of events ?? []) counts[roleForEventType(event.eventType)] += 1;
    return counts;
  }, [events]);

  return (
    <PageContainer wide>
      <PageHeader
        action={(
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent-foreground/90"
            onClick={() => setHandoffOpen(true)}
            type="button"
          >
            <Bot aria-hidden="true" size={15} />
            Hand new work to your agent
          </button>
        )}
        description="The action queue: tasks open to pick up, claims moving through verification, and every write workflow within one click."
        eyebrow="Work"
        title="What you can do now"
      />
      {error ? <ErrorState className="mt-10" message={error} onRetry={load} /> : null}

      <section aria-label="Manual submission fallback" className="mt-6">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Research writing on EviMesh is agent-led: describe the intent and hand it to your agent with full context.
          The web reads and explains; agents draft, humans sign.
        </p>
        <details className="mt-3 rounded-lg border border-border bg-card px-5 py-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Manual submission (fallback for no-agent and accessibility paths)
          </summary>
          <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
            These web forms are the retained fallback, not the primary path. The agent handoff above is the main
            interaction for structured research writing.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CREATE_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                href={href}
                key={href}
              >
                <Icon aria-hidden="true" size={14} />
                {label}
              </Link>
            ))}
          </div>
        </details>
      </section>

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Work views">
        {TABS.map((entry) => {
          const total = entry.id === 'tasks' ? (openTasks?.length ?? 0)
            : entry.id === 'verify' ? (verificationClaims?.length ?? 0)
              : null;
          return (
            <button
              aria-selected={tab === entry.id}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                tab === entry.id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              key={entry.id}
              onClick={() => setTab(entry.id)}
              role="tab"
              type="button"
            >
              {entry.label}
              {total !== null ? (
                <span className={cn('rounded-full border px-1.5 text-[11px] font-medium tabular-nums', entry.id === 'verify' ? 'border-status-accent-border bg-status-accent-bg text-status-accent-fg' : 'border-border bg-muted text-muted-foreground')}>{total}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === 'tasks' ? (
        <section className="mt-6" aria-label="Open tasks">
          {openTasks === null ? <Skeleton className="h-24 w-full" /> : openTasks.length === 0 ? (
            <Empty description="Tasks open for pickup will appear here." title="No open tasks" />
          ) : (
            <Card className="divide-y divide-border">
              {openTasks.map((task) => (
                <article className="grid gap-1.5 px-5 py-4" key={task.taskId}>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge state="open" />
                    {task.title ? (
                      <Link className="min-w-0 flex-1 truncate font-medium hover:underline" href={`/tasks/${task.taskId}`}>{task.title}</Link>
                    ) : (
                      <IdChip className="min-w-0 flex-1" value={task.taskId} />
                    )}
                    <button className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setRowHandoff({ objectType: 'task', objectId: task.taskId, intent: 'Run this task with your agent' })} type="button">Hand to agent</button>
                    <Link className="text-xs text-muted-foreground hover:text-foreground" href="/runs/new">manual receipt</Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <IdChip value={task.taskId} />
                    <span className="tabular-nums">project {task.projectId ?? 'unassigned'}</span>
                  </div>
                </article>
              ))}
            </Card>
          )}
          <Link className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground" href="/tasks">Full task board →</Link>
        </section>
      ) : null}

      {tab === 'verify' ? (
        <section className="mt-6" aria-label="Verification queue">
          {verificationClaims === null ? <Skeleton className="h-24 w-full" /> : verificationClaims.length === 0 ? (
            <Empty description="Claims under verification will appear here with their contracts." title="Nothing in verification" />
          ) : (
            <Card className="divide-y divide-border">
              {verificationClaims.map((claim) => (
                <article className="flex flex-wrap items-center gap-3 px-5 py-4" key={claim.claimId}>
                  <StatusBadge state={claim.state} />
                  <IdChip value={claim.claimId} />
                  <Link className="text-xs font-medium text-primary hover:underline" href={`/claims/${claim.claimId}`}>open</Link>
                  <button className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setRowHandoff({ objectType: 'claim', objectId: claim.claimId, intent: 'Verify this claim with your agent' })} type="button">Hand to agent</button>
                  <Link className="text-xs text-muted-foreground hover:text-foreground" href="/verification/receipt/new">manual receipt</Link>
                  <span className="ml-auto text-xs text-muted-foreground">receipts record outcomes and findings, never a score</span>
                </article>
              ))}
            </Card>
          )}
          <Link className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground" href="/verification">Verification workspace →</Link>
        </section>
      ) : null}

      {tab === 'challenges' ? (
        <section className="mt-6" aria-label="Challenges">
          <Empty
            action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/challenges/new">Raise a challenge</Link>}
            description="Challenges are tracked per claim revision. Open the target claim to read an active challenge and its impact; a challenge list endpoint ships with the protocol surface."
            title="Challenge tracking lives on each claim"
          />
        </section>
      ) : null}

      {tab === 'drafts' ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Drafts">
          <Card>
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">Claim draft</h3>
            </div>
            <CardContent>
              <p className="text-sm text-muted-foreground">The claim editor keeps browser-local IndexedDB drafts with JSON/ZIP bundle import and export.</p>
              <div className="mt-3 flex gap-2">
                <Link className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" href="/claims/new">Continue editing</Link>
              </div>
            </CardContent>
          </Card>
          <Card>
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">Run receipt draft</h3>
            </div>
            <CardContent>
              <p className="text-sm text-muted-foreground">Run receipts save locally as you fill environment, command, seed, and outputs.</p>
              <div className="mt-3 flex gap-2">
                <Link className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" href="/runs/new">Continue filling</Link>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {tab === 'record' ? (
        <section className="mt-6" aria-label="Contribution record">
          {events === null ? <Skeleton className="h-32 w-full" /> : (
            <div className="grid gap-6">
              <Card>
                <div className="border-b border-border px-5 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Role distribution</h3>
                <p className="mt-1 text-xs text-muted-foreground">{scopedActor ? 'Scoped to the signed-in actor.' : 'Network-wide record: no signed-in actor detected.'}</p>
                </div>
                <CardContent>
                  <RoleBar counts={roleCounts} />
                  <p className="mt-3 text-xs text-muted-foreground">Roles inferred from signed event types; counts only, never points or rankings.</p>
                </CardContent>
              </Card>
              <Card className="px-5 py-2">
                <ol className="list-none">
                  {(events ?? []).slice(-10).reverse().map((event) => {
                    const type = event.eventType ?? 'event';
                    const EventIcon = type.startsWith('frontier') ? FileCheck2 : type.startsWith('claim') ? GitPullRequestArrow : type.startsWith('evidence') ? FlaskConical : History;
                    return (
                      <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-border py-4 last:border-b-0" key={event.eventId}>
                        <span aria-hidden="true" className="mt-0.5 grid size-8 place-items-center rounded-full bg-muted text-muted-foreground"><EventIcon size={15} /></span>
                        <div className="min-w-0">
                          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{type}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <IdChip value={event.eventId} />
                            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{relativeTime(event.createdAt)}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>
              <div className="flex gap-3">
                <Link className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" href="/contributions">My contributions</Link>
                <Link className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" href="/events"><History aria-hidden="true" className="mr-2 inline" size={14} />Event audit</Link>
              </div>
            </div>
          )}
        </section>
      ) : null}
      <HandoffSheet
        cliCommand={`sq question list   # find where to contribute
sq task list       # open tasks to pick up`}
        intent="Hand new research work to your agent"
        mcpCall={`tool:     search_open_tasks (read-only)
resource: evimesh://questions/open`}
        objectId="work-queue"
        objectType="work"
        onOpenChange={setHandoffOpen}
        open={handoffOpen}
        scopes={['read', 'drafts']}
        view="work"
      />
      {rowHandoff ? (
        <HandoffSheet
          cliCommand={`sq task inspect ${rowHandoff.objectId}   # read inputs, outputs, acceptance
sq attempt start ${rowHandoff.objectId}     # begin an attributed attempt`}
          intent={rowHandoff.intent}
          mcpCall={`tool:     get_task_context (read-only)
tool:     start_attempt (confirm: true)`}
          objectId={rowHandoff.objectId}
          objectType={rowHandoff.objectType}
          onOpenChange={(open) => { if (!open) setRowHandoff(null); }}
          open={Boolean(rowHandoff)}
          scopes={['read', 'attempts', 'drafts']}
          view="work"
        />
      ) : null}
    </PageContainer>
  );
}
