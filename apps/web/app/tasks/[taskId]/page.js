'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

async function request(path) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Task data is unavailable.');
  return payload;
}

function JsonBlock({ value }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify(value ?? [], null, 2)}</pre>;
}

export default function TaskDetailPage({ params }) {
  const [taskId, setTaskId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ taskId: value }) => setTaskId(value)); }, [params]);
  useEffect(() => {
    if (!taskId) return;
    request(`/tasks/${taskId}`).then(setData).catch((reason) => setError(reason.message));
  }, [taskId]);
  if (error) return <main className="mx-auto max-w-5xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-5xl px-6 py-16" aria-busy="true">Loading task…</main>;
  const { task, currentRevision, dependencies = [], leases = [] } = data;
  return <main className="mx-auto max-w-5xl px-6 py-16"><Link className="text-sm text-primary hover:underline" href="/tasks">← Back to Task board</Link><p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">{task.state}</p><h1 className="mt-3 text-4xl font-semibold">{currentRevision.title}</h1><p className="mt-3 font-mono text-sm text-muted-foreground">{task.taskId}</p><p className="mt-6 max-w-3xl text-muted-foreground">{currentRevision.description}</p><div className="mt-8 grid gap-4 sm:grid-cols-3"><section className="rounded-lg border border-border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Revision</p><p className="mt-2 text-2xl font-semibold">{currentRevision.revision}</p></section><section className="rounded-lg border border-border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Context Mode</p><p className="mt-2 font-medium">{currentRevision.contextMode}</p></section><section className="rounded-lg border border-border p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Question</p><p className="mt-2 font-mono text-sm">{currentRevision.questionId ?? 'Not linked'}</p></section></div><section className="mt-10 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Inputs</h2><JsonBlock value={currentRevision.inputs} /></section><section className="mt-6 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Outputs</h2><JsonBlock value={currentRevision.outputs} /></section><section className="mt-6 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Acceptance</h2><JsonBlock value={currentRevision.acceptance} /></section><section className="mt-6 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Dependencies</h2>{dependencies.length ? <ul className="mt-3 space-y-2">{dependencies.map((dependency, index) => <li className="rounded border border-border p-3 font-mono text-sm" key={`${dependency.sourceTaskId ?? dependency.sourceTaskId ?? 'dependency'}-${index}`}>{JSON.stringify(dependency)}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No dependencies.</p>}</section><section className="mt-6 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">Leases</h2>{leases.length ? <ul className="mt-3 space-y-2">{leases.map((lease, index) => <li className="rounded border border-border p-3 text-sm" key={`${lease.holderActorId ?? 'lease'}-${index}`}>{JSON.stringify(lease)}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No active leases.</p>}</section></main>;
}
