'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HandoffSheet } from '@/components/handoff-sheet';
import { StatusBadge } from '@/components/ui/data';
import { ActorName, Identifier, MarginSection, formatDate, shortId } from '@/components/ui/doc';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Task data is unavailable.');
  return payload;
}

function JsonBlock({ value }) {
  return <pre className="mt-3 overflow-x-auto border border-border bg-muted p-3 font-mono text-xs leading-6">{JSON.stringify(value ?? [], null, 2)}</pre>;
}

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

function SectionHead({ id, title, count }) {
  return <SectionHeader action={count !== undefined ? <span className="tabular-nums text-muted-foreground">{count}</span> : null} id={id} title={title} />;
}

export default function TaskDetailPage({ params }) {
  const [taskId, setTaskId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  useEffect(() => { Promise.resolve(params).then(({ taskId: value }) => setTaskId(value)); }, [params]);
  useEffect(() => {
    if (!taskId) return;
    request(`/tasks/${taskId}`).then(setData).catch((reason) => setError(reason.message));
  }, [taskId]);
  async function reload() {
    setError(null);
    try { setData(await request(`/tasks/${taskId}`)); } catch (reason) { setError(reason.message); }
  }
  if (error) return <PageContainer><ErrorState message={error} onRetry={reload} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;
  const { task, currentRevision, dependencies = [], leases = [] } = data;
  const createdBy = currentRevision.createdBy ?? task.createdBy ?? null;
  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Tasks', href: '/tasks' }, { label: `Task r${currentRevision.revision}` }]} />
      <PageHeader
        action={<Button onClick={() => setHandoffOpen(true)} size="sm" type="button" variant="outline">Open Agent handoff</Button>}
        title={currentRevision.title}
      />
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><StatusBadge state={task.state} /><span>Task r{currentRevision.revision}</span></p>
      {currentRevision.description ? <p className="mt-3 max-w-[70ch] font-serif text-base leading-7">{currentRevision.description}</p> : null}

      <div className="doc-grid mt-8">
        <div className="doc-main grid gap-8">

          <section aria-labelledby="inputs-heading"><SectionHead id="inputs-heading" title="Inputs" /><JsonBlock value={currentRevision.inputs} /></section>
          <section aria-labelledby="outputs-heading"><SectionHead id="outputs-heading" title="Outputs" /><JsonBlock value={currentRevision.outputs} /></section>
          <section aria-labelledby="acceptance-heading"><SectionHead id="acceptance-heading" title="Acceptance" /><JsonBlock value={currentRevision.acceptance} /></section>

          <section aria-labelledby="dependencies-heading">
            <SectionHead count={dependencies.length} id="dependencies-heading" title="Dependencies" />
            {dependencies.length ? (
              <ul>
                {dependencies.map((dependency, index) => {
                  const other = dependency.sourceTaskId === task.taskId ? dependency.targetTaskId : (dependency.sourceTaskId ?? dependency.targetTaskId);
                  return (
                    <li className="ref-row" key={`${dependency.sourceTaskId ?? dependency.targetTaskId ?? 'dependency'}-${index}`}>
                      <p className="text-sm text-muted-foreground">{readable(dependency.relationType ?? dependency.dependencyType ?? 'depends on')}</p>
                      <div className="min-w-0">
                        {other ? <Link className="font-mono text-sm hover:text-primary hover:underline" href={`/tasks/${encodeURIComponent(other)}`} title={other}>{shortId(other)}</Link> : null}
                        <pre className="mt-1 overflow-x-auto font-mono text-xs text-muted-foreground">{JSON.stringify(dependency)}</pre>
                      </div>
                      <p className="text-xs tabular-nums text-muted-foreground md:text-right">{formatDate(dependency.createdAt)}</p>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty className="border-t-0" title="No dependencies" />}
          </section>

          <section aria-labelledby="leases-heading">
            <SectionHead count={leases.length} id="leases-heading" title="Leases" />
            {leases.length ? (
              <ul>
                {leases.map((lease, index) => (
                  <li className="ref-row" key={`${lease.holderActorId ?? 'lease'}-${index}`}>
                    <div>{lease.state ?? lease.status ? <StatusBadge state={lease.state ?? lease.status} /> : <p className="text-sm text-muted-foreground">Lease</p>}</div>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm"><span className="text-muted-foreground">Held by</span><ActorName actorId={lease.holderActorId} /></p>
                      <pre className="mt-1 overflow-x-auto font-mono text-xs text-muted-foreground">{JSON.stringify(lease)}</pre>
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground md:text-right">{formatDate(lease.expiresAt ?? lease.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <Empty className="border-t-0" title="No active leases" />}
          </section>
        </div>

        <aside aria-label="Task record" className="doc-margin">
          <MarginSection title="Record">
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Identifier</dt><dd className="mt-0.5"><Identifier value={task.taskId} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Revision</dt><dd className="mt-0.5 tabular-nums">r{currentRevision.revision}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Context mode</dt><dd className="mt-0.5">{readable(currentRevision.contextMode) || 'not stated'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Question</dt><dd className="mt-0.5">{currentRevision.questionId ? <Link className="font-mono text-xs hover:text-primary hover:underline" href={`/questions/${currentRevision.questionId}`} title={currentRevision.questionId}>{shortId(currentRevision.questionId)}</Link> : <span className="text-muted-foreground">Not linked</span>}</dd></div>
              {createdBy ? <div><dt className="text-xs text-muted-foreground">Drafted by</dt><dd className="mt-0.5"><ActorName actorId={createdBy} /></dd></div> : null}
              {currentRevision.createdAt ?? task.createdAt ? <div><dt className="text-xs text-muted-foreground">Recorded</dt><dd className="mt-0.5 tabular-nums">{formatDate(currentRevision.createdAt ?? task.createdAt)}</dd></div> : null}
            </dl>
          </MarginSection>
          <MarginSection title="Audit">
            <Link className="text-sm text-primary hover:underline" href={`/events?objectType=task&objectId=${task.taskId}`}>Event audit</Link>
          </MarginSection>
        </aside>
      </div>

      <HandoffSheet
        cliCommand={`sq task inspect ${task.taskId}   # read inputs, outputs, acceptance
sq attempt start ${task.taskId}     # begin an attributed attempt`}
        intent="Run this task with your agent"
        mcpCall={`tool:     get_task_context (read-only)
tool:     start_attempt (confirm: true)`}
        objectId={task.taskId}
        objectType="task"
        onOpenChange={setHandoffOpen}
        open={handoffOpen}
        scopes={['read', 'attempts', 'drafts']}
        view="task"
      />
    </PageContainer>
  );
}
