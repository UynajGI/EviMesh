'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity, FileCheck2, FlaskConical, GitPullRequestArrow, Scale, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';

const CREATE_LINKS = [
  { href: '/questions/new', label: 'New question', icon: GitPullRequestArrow },
  { href: '/claims/new', label: 'New claim', icon: GitPullRequestArrow },
  { href: '/evidence/new', label: 'Add evidence', icon: FlaskConical },
  { href: '/challenges/new', label: 'Raise a challenge', icon: Scale },
  { href: '/runs/new', label: 'Start a run', icon: Activity },
  { href: '/verification/receipt/new', label: 'Record verification', icon: ShieldCheck },
];

async function fetchList(path) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `${path} is unavailable.`);
  return payload.items ?? [];
}

/*
 * Work (M13.8 05-core-ui-spec.md §4): the action queue. Tasks to pick up,
 * verification in flight, and every write workflow kept one click away.
 */
export default function WorkPage() {
  const [openTasks, setOpenTasks] = useState([]);
  const [verificationClaims, setVerificationClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [tasks, claims] = await Promise.all([
        fetchList('/tasks?status=open&limit=8'),
        fetchList('/claims?status=under_verification&limit=8'),
      ]);
      setOpenTasks(tasks);
      setVerificationClaims(claims);
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
        description="The action queue: tasks open to pick up, claims moving through verification, and every write workflow within one click."
        eyebrow="Work"
        title="What you can do now"
      />
      {error ? <ErrorState className="mt-10" message={error} onRetry={load} /> : null}

      <section aria-labelledby="create-heading" className="mt-10">
        <SectionHeader title="Start something" id="create-heading" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CREATE_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" className="text-muted-foreground" size={16} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="open-tasks-heading" className="mt-12">
        <SectionHeader action={<Link className="text-sm text-muted-foreground hover:text-foreground" href="/tasks">Task board</Link>} title="Open tasks" />
        {loading ? <Skeleton className="mt-4 h-24 w-full" /> : error ? null : openTasks.length === 0 ? (
          <Empty className="mt-4" description="Tasks open for pickup will appear here." title="No open tasks" />
        ) : (
          <Card className="mt-4 divide-y divide-border">
            {openTasks.map((task) => (
              <article className="flex flex-wrap items-center gap-3 px-5 py-4" key={task.taskId}>
                <StatusBadge state="open" />
                <Link className="min-w-0 hover:underline" href={`/tasks/${task.taskId}`}><IdChip value={task.taskId} /></Link>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">project {task.projectId ?? 'unassigned'}</span>
              </article>
            ))}
          </Card>
        )}
      </section>

      <section aria-labelledby="verify-heading" className="mt-12">
        <SectionHeader action={<Link className="text-sm text-muted-foreground hover:text-foreground" href="/verification">Verification workspace</Link>} title="In verification" />
        {loading ? <Skeleton className="mt-4 h-24 w-full" /> : error ? null : verificationClaims.length === 0 ? (
          <Empty className="mt-4" description="Claims under verification will appear here with their contracts." title="Nothing in verification" />
        ) : (
          <Card className="mt-4 divide-y divide-border">
            {verificationClaims.map((claim) => (
              <article className="flex flex-wrap items-center gap-3 px-5 py-4" key={claim.claimId}>
                <StatusBadge state={claim.state} />
                <Link className="min-w-0 hover:underline" href={`/claims/${claim.claimId}`}><IdChip value={claim.claimId} /></Link>
                <span className="ml-auto text-xs text-muted-foreground">receipts record outcomes and findings, never a score</span>
              </article>
            ))}
          </Card>
        )}
      </section>

      <section aria-labelledby="record-heading" className="mt-12">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-medium" id="record-heading">Your contribution record</h2>
              <p className="mt-1 text-sm text-muted-foreground">Roles and events, never points or rankings.</p>
            </div>
            <div className="flex gap-3">
              <Link className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" href="/contributions">My contributions</Link>
              <Link className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted" href="/events"><FileCheck2 aria-hidden="true" className="mr-2 inline" size={14} />Event audit</Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  );
}
