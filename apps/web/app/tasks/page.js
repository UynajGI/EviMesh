'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const LANES = ['draft', 'open', 'active', 'blocked', 'verification_requested', 'completed', 'cancelled'];

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/tasks?limit=100`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Tasks are unavailable.');
      setTasks(body.items ?? []);
    }).catch((reason) => setError(reason.message));
  }, []);
  const byState = new Map(LANES.map((state) => [state, tasks.filter((task) => task.status === state || task.state === state)]));
  const unknown = tasks.filter((task) => !LANES.includes(task.status ?? task.state));
  if (error) return <main className="mx-auto max-w-6xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  return <main className="mx-auto max-w-7xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Work queue</p><h1 className="mt-3 text-5xl font-semibold tracking-tight">Task board</h1><p className="mt-4 max-w-2xl text-muted-foreground">See bounded research work move from draft to completion, including blocked and verification states.</p><div className="mt-10 grid gap-4 overflow-x-auto pb-4 lg:grid-cols-4">{LANES.map((state) => <section className="min-h-64 min-w-64 rounded-xl border border-border bg-muted/30 p-4" aria-labelledby={`${state}-lane`} key={state}><div className="flex items-center justify-between gap-3"><h2 id={`${state}-lane`} className="font-semibold capitalize">{state.replaceAll('_', ' ')}</h2><span className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">{byState.get(state).length}</span></div><ul className="mt-4 space-y-3">{byState.get(state).map((task) => <li key={task.taskId}><Link className="block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary" href={`/tasks/${task.taskId}`}><p className="font-mono text-sm">{task.taskId}</p><p className="mt-2 text-xs text-muted-foreground">{task.projectId ? `Project ${task.projectId}` : 'Unassigned project'}</p>{task.tag && <span className="mt-3 inline-block rounded-full bg-muted px-2 py-1 text-xs">{task.tag}</span>}</Link></li>)}</ul>{byState.get(state).length === 0 && <p className="mt-5 text-xs text-muted-foreground">No tasks in this lane.</p>}</section>)}{unknown.length > 0 && <section className="min-h-64 min-w-64 rounded-xl border border-destructive/40 bg-destructive/5 p-4"><h2 className="font-semibold">Unrecognized state</h2><ul className="mt-4 space-y-3">{unknown.map((task) => <li key={task.taskId} className="rounded-lg border border-border bg-card p-4 font-mono text-sm">{task.taskId}</li>)}</ul></section>}</div></main>;
}
