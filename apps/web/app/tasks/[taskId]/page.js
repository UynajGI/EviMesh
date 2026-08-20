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
  const [attempt, setAttempt] = useState(null);
  const [contextBundle, setContextBundle] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [leasePending, setLeasePending] = useState(false);
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
  async function startAttempt() {
    setActionPending(true); setActionError(null);
    try {
      const bundle = await request(`/tasks/${taskId}/context?mode=${encodeURIComponent(currentRevision.contextMode)}`);
      const { data: sessionData } = await import('@/lib/supabase-browser').then(({ createBrowserSupabaseClient }) => createBrowserSupabaseClient().auth.getSession());
      const response = await fetch(`${API}/tasks/${taskId}/attempts`, { method: 'POST', headers: { authorization: `Bearer ${sessionData.session?.access_token ?? ''}`, 'content-type': 'application/json' }, body: JSON.stringify({ attemptId: crypto.randomUUID(), contextBundleId: bundle.contextBundleId, contextMode: currentRevision.contextMode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Attempt creation failed.');
      setAttempt(body.attempt); setContextBundle(bundle);
    } catch (reason) { setActionError(reason.message); }
    finally { setActionPending(false); }
  }
  async function updateLease(method) {
    setLeasePending(true); setActionError(null);
    try {
      const { data: sessionData } = await import('@/lib/supabase-browser').then(({ createBrowserSupabaseClient }) => createBrowserSupabaseClient().auth.getSession());
      const response = await fetch(`${API}/tasks/${taskId}/lease`, { method, headers: { authorization: `Bearer ${sessionData.session?.access_token ?? ''}`, 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Lease operation failed.');
      setData(await request(`/tasks/${taskId}`));
    } catch (reason) { setActionError(reason.message); }
    finally { setLeasePending(false); }
  }
  if (error) return <PageContainer><ErrorState message={error} onRetry={reload} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-96 w-full" /></PageContainer>;
  const { task, currentRevision, dependencies = [], leases = [] } = data;
  const contextDownload = contextBundle ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(contextBundle, null, 2))}` : null;
  const stats = [
    { label: 'Revision', value: String(currentRevision.revision) },
    { label: 'Context Mode', value: currentRevision.contextMode },
    { label: 'Question', value: currentRevision.questionId ?? 'Not linked' },
  ];
  return <PageContainer><Link className="text-sm font-medium text-primary hover:underline" href="/tasks">← Back to Task board</Link><PageHeader eyebrow="Task" title={currentRevision.title} description={currentRevision.description} action={<div className="flex flex-wrap items-center gap-3"><Badge variant={stateVariant(task.state)}>{task.state.replaceAll('_', ' ')}</Badge><Button type="button" onClick={() => setHandoffOpen(true)}>Run this task with an agent</Button></div>} /><p className="mt-2 font-mono text-sm tabular-nums text-muted-foreground">{task.taskId}</p>
    <section className="mt-10 rounded-lg border border-primary/30 bg-primary/5 p-5" aria-labelledby="attempt-heading"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="attempt-heading" className="text-lg font-semibold">Attempt <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">manual fallback</span></h2><p className="mt-1 text-sm text-muted-foreground">Start an Attempt using the task&apos;s {currentRevision.contextMode} Context Mode.</p></div><Button type="button" onClick={startAttempt} loading={actionPending} disabled={Boolean(attempt)}>{attempt ? 'Attempt started' : 'Start Attempt'}</Button></div>{actionError && <p role="alert" className="mt-3 text-sm text-destructive">{actionError}</p>}{attempt && <p className="mt-3 font-mono text-xs tabular-nums text-muted-foreground">{attempt.attemptId} · {attempt.state}</p>}{contextDownload && <a className="mt-4 inline-block text-sm font-medium text-primary underline" href={contextDownload} download={`${task.taskId}-${currentRevision.contextMode}-context.json`}>Download Context bundle</a>}</section>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">{stats.map((stat) => <div className="rounded-lg border border-border bg-card p-4" key={stat.label}><p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p><p className="mt-2 font-medium tabular-nums">{stat.value}</p></div>)}</div>
    <section className="mt-10" aria-labelledby="inputs-heading"><h2 id="inputs-heading" className="text-lg font-semibold">Inputs</h2><JsonBlock value={currentRevision.inputs} /></section>
    <section className="mt-6" aria-labelledby="outputs-heading"><h2 id="outputs-heading" className="text-lg font-semibold">Outputs</h2><JsonBlock value={currentRevision.outputs} /></section>
    <section className="mt-6" aria-labelledby="acceptance-heading"><h2 id="acceptance-heading" className="text-lg font-semibold">Acceptance</h2><JsonBlock value={currentRevision.acceptance} /></section>
    <section className="mt-6" aria-labelledby="dependencies-heading"><h2 id="dependencies-heading" className="text-lg font-semibold">Dependencies</h2>{dependencies.length ? <ul className="mt-3 space-y-2">{dependencies.map((dependency, index) => <li className="rounded-lg border border-border bg-card p-3 font-mono text-xs tabular-nums" key={`${dependency.sourceTaskId ?? dependency.targetTaskId ?? 'dependency'}-${index}`}>{JSON.stringify(dependency)}</li>)}</ul> : <Empty className="mt-3" title="No dependencies" description="This task does not depend on other tasks." />}</section>
    <section className="mt-6" aria-labelledby="leases-heading"><div className="flex flex-wrap items-center justify-between gap-4"><h2 id="leases-heading" className="text-lg font-semibold">Leases</h2><div className="flex gap-2"><Button variant="secondary" type="button" onClick={() => updateLease('POST')} loading={leasePending}>Acquire lease</Button><Button variant="outline" type="button" onClick={() => updateLease('DELETE')} disabled={leasePending || leases.length === 0} className="text-destructive">Release my lease</Button></div></div>{leases.length ? <ul className="mt-3 space-y-2">{leases.map((lease, index) => <li className="rounded-lg border border-border bg-card p-3 text-sm tabular-nums" key={`${lease.holderActorId ?? 'lease'}-${index}`}>{JSON.stringify(lease)}</li>)}</ul> : <Empty className="mt-3" title="No active leases" description="Acquire a lease to reserve this task for work." />}</section>

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
