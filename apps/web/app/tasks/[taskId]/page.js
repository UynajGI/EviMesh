'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HandoffSheet } from '@/components/handoff-sheet';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Task data is unavailable.');
  return payload;
}

function JsonBlock({ value }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify(value ?? [], null, 2)}</pre>;
}

function stateVariant(state) {
  switch (state) {
    case 'completed': return 'success';
    case 'blocked': return 'warning';
    case 'cancelled': return 'destructive';
    case 'active': return 'info';
    default: return 'default';
  }
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
  const stats = [
    { label: 'Revision', value: String(currentRevision.revision) },
    { label: 'Context Mode', value: currentRevision.contextMode },
    { label: 'Question', value: currentRevision.questionId ?? 'Not linked' },
  ];
  return <PageContainer><Link className="text-sm font-medium text-primary hover:underline" href="/tasks">← Back to Task board</Link><PageHeader eyebrow="Task" title={currentRevision.title} description={currentRevision.description} showDescription action={<div className="flex flex-wrap items-center gap-3"><Badge variant={stateVariant(task.state)}>{task.state.replaceAll('_', ' ')}</Badge><Button type="button" onClick={() => setHandoffOpen(true)}>Run this task with an agent</Button></div>} /><p className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">{task.taskId}</p>
    <section className="mt-10 grid min-w-0 grid-cols-12 border-y border-foreground py-5" aria-labelledby="attempt-heading"><div className="col-span-12 min-w-0 sm:col-span-8"><p className="font-mono text-[10px] font-bold uppercase text-primary">AGENT HANDOFF</p><h2 id="attempt-heading" className="mt-2 font-serif text-3xl font-medium tracking-[-0.03em]">Attempts begin outside the reading surface.</h2><p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground">Use the Agent connection or <code>sq attempt start {task.taskId}</code>. The resulting Attempt and ContextBundle remain visible here.</p></div><div className="col-span-12 mt-5 sm:col-span-4 sm:mt-0 sm:text-right"><Button type="button" onClick={() => setHandoffOpen(true)}>Open Agent handoff</Button></div></section>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">{stats.map((stat) => <div className="rounded-lg border border-border bg-card p-4" key={stat.label}><p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p><p className="mt-2 font-medium tabular-nums">{stat.value}</p></div>)}</div>
    <section className="mt-10" aria-labelledby="inputs-heading"><h2 id="inputs-heading" className="text-lg font-semibold">Inputs</h2><JsonBlock value={currentRevision.inputs} /></section>
    <section className="mt-6" aria-labelledby="outputs-heading"><h2 id="outputs-heading" className="text-lg font-semibold">Outputs</h2><JsonBlock value={currentRevision.outputs} /></section>
    <section className="mt-6" aria-labelledby="acceptance-heading"><h2 id="acceptance-heading" className="text-lg font-semibold">Acceptance</h2><JsonBlock value={currentRevision.acceptance} /></section>
    <section className="mt-6" aria-labelledby="dependencies-heading"><h2 id="dependencies-heading" className="text-lg font-semibold">Dependencies</h2>{dependencies.length ? <ul className="mt-3 space-y-2">{dependencies.map((dependency, index) => <li className="rounded-lg border border-border bg-card p-3 font-mono text-xs tabular-nums" key={`${dependency.sourceTaskId ?? dependency.targetTaskId ?? 'dependency'}-${index}`}>{JSON.stringify(dependency)}</li>)}</ul> : <Empty className="mt-3" title="No dependencies" description="This task does not depend on other tasks." />}</section>
    <section className="mt-6" aria-labelledby="leases-heading"><h2 id="leases-heading" className="text-lg font-semibold">Leases</h2>{leases.length ? <ul className="mt-3 space-y-2">{leases.map((lease, index) => <li className="rounded-lg border border-border bg-card p-3 text-sm tabular-nums" key={`${lease.holderActorId ?? 'lease'}-${index}`}>{JSON.stringify(lease)}</li>)}</ul> : <Empty className="mt-3" title="No active leases" description="Lease activity from Agent and CLI work will appear here." />}</section>

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
    </PageContainer>;
}
