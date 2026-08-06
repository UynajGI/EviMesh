'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const LANES = ['draft', 'open', 'active', 'blocked', 'verification_requested', 'completed', 'cancelled'];
const CONTEXT_MODES = ['frontier', 'full_trace', 'adversarial', 'blind'];

function taskState(task) {
  return task.status ?? task.state ?? 'unknown';
}

function taskType(task) {
  return task.type ?? task.taskType ?? '';
}

function taskTag(task) {
  if (typeof task.tag === 'string') return task.tag;
  if (Array.isArray(task.tags)) return task.tags.join(', ');
  return '';
}

function taskContextMode(task) {
  return task.contextMode ?? task.currentRevision?.contextMode ?? task.revision?.contextMode ?? '';
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ type: '', status: '', tag: '', contextMode: '' });
  useEffect(() => {
    const query = new URLSearchParams({ limit: '100' });
    for (const key of ['type', 'status', 'tag']) if (filters[key]) query.set(key, filters[key]);
    fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/tasks?${query.toString()}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Tasks are unavailable.');
      setTasks(body.items ?? []);
    }).catch((reason) => setError(reason.message));
  }, [filters]);
  const types = [...new Set(tasks.map(taskType).filter(Boolean))].sort();
  const filteredTasks = tasks.filter((task) => !filters.contextMode || taskContextMode(task) === filters.contextMode);
  const byState = new Map(LANES.map((state) => [state, filteredTasks.filter((task) => taskState(task) === state)]));
  const unknown = filteredTasks.filter((task) => !LANES.includes(taskState(task)));
  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  if (error) return <main className="mx-auto max-w-6xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  return <main className="mx-auto max-w-7xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Work queue</p><h1 className="mt-3 text-5xl font-semibold tracking-tight">Task board</h1><p className="mt-4 max-w-2xl text-muted-foreground">See bounded research work move from draft to completion, including blocked and verification states.</p><div className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-2 text-sm font-medium">Type<select className="rounded-md border border-input bg-background px-3 py-2 font-normal" value={filters.type} onChange={updateFilter('type')}><option value="">All types</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Status<select className="rounded-md border border-input bg-background px-3 py-2 font-normal" value={filters.status} onChange={updateFilter('status')}><option value="">All statuses</option>{LANES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Tag<input className="rounded-md border border-input bg-background px-3 py-2 font-normal" value={filters.tag} onChange={updateFilter('tag')} placeholder="Filter by tag" /></label><label className="grid gap-2 text-sm font-medium">Context Mode<select className="rounded-md border border-input bg-background px-3 py-2 font-normal" value={filters.contextMode} onChange={updateFilter('contextMode')}><option value="">All context modes</option>{CONTEXT_MODES.map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>)}</select></label></div><div className="mt-10 grid gap-4 overflow-x-auto pb-4 lg:grid-cols-4">{LANES.map((state) => <section className="min-h-64 min-w-64 rounded-xl border border-border bg-muted/30 p-4" aria-labelledby={`${state}-lane`} key={state}><div className="flex items-center justify-between gap-3"><h2 id={`${state}-lane`} className="font-semibold capitalize">{state.replaceAll('_', ' ')}</h2><span className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">{byState.get(state).length}</span></div><ul className="mt-4 space-y-3">{byState.get(state).map((task) => <li key={task.taskId}><Link className="block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary" href={`/tasks/${task.taskId}`}><p className="font-mono text-sm">{task.taskId}</p><p className="mt-2 text-xs text-muted-foreground">{task.projectId ? `Project ${task.projectId}` : 'Unassigned project'}</p>{taskType(task) && <span className="mt-3 mr-2 inline-block rounded-full bg-muted px-2 py-1 text-xs">{taskType(task)}</span>}{taskTag(task) && <span className="mt-3 inline-block rounded-full bg-muted px-2 py-1 text-xs">{taskTag(task)}</span>}{taskContextMode(task) && <p className="mt-3 text-xs text-muted-foreground">Context: {taskContextMode(task)}</p>}</Link></li>)}</ul>{byState.get(state).length === 0 && <p className="mt-5 text-xs text-muted-foreground">No tasks in this lane.</p>}</section>)}{unknown.length > 0 && <section className="min-h-64 min-w-64 rounded-xl border border-destructive/40 bg-destructive/5 p-4"><h2 className="font-semibold">Unrecognized state</h2><ul className="mt-4 space-y-3">{unknown.map((task) => <li key={task.taskId} className="rounded-lg border border-border bg-card p-4 font-mono text-sm">{task.taskId}</li>)}</ul></section>}</div></main>;
}
