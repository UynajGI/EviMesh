'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ type: '', status: '', tag: '', contextMode: '' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ limit: '100' });
      for (const key of ['type', 'status', 'tag']) if (filters[key]) query.set(key, filters[key]);
      const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/tasks?${query.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Tasks are unavailable.');
      setTasks(body.items ?? []);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filters]);

  const types = [...new Set(tasks.map(taskType).filter(Boolean))].sort();
  const filteredTasks = tasks.filter((task) => !filters.contextMode || taskContextMode(task) === filters.contextMode);
  const byState = new Map(LANES.map((state) => [state, filteredTasks.filter((task) => taskState(task) === state)]));
  const unknown = filteredTasks.filter((task) => !LANES.includes(taskState(task)));
  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));

  const filtersPanel = (
    <div className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="grid gap-2"><Label htmlFor="task-type">Type</Label><Select id="task-type" value={filters.type} onChange={updateFilter('type')}><option value="">All types</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="task-status">Status</Label><Select id="task-status" value={filters.status} onChange={updateFilter('status')}><option value="">All statuses</option>{LANES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="task-tag">Tag</Label><Input id="task-tag" value={filters.tag} onChange={updateFilter('tag')} placeholder="Filter by tag" /></div>
      <div className="grid gap-2"><Label htmlFor="task-mode">Context Mode</Label><Select id="task-mode" value={filters.contextMode} onChange={updateFilter('contextMode')}><option value="">All context modes</option>{CONTEXT_MODES.map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>)}</Select></div>
    </div>
  );

  if (error) {
    return <PageContainer><PageHeader eyebrow="Work queue" title="Task board" description="See bounded research work move from draft to completion." /><ErrorState className="mt-8" message={error} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader eyebrow="Work queue" title="Task board" description="See bounded research work move from draft to completion, including blocked and verification states." />
      {loading ? <Skeleton className="mt-8 h-24 w-full" /> : filtersPanel}
      {loading ? <Skeleton className="mt-10 h-96 w-full" /> : <div className="mt-10 grid gap-4 overflow-x-auto pb-4 lg:grid-cols-4">
        {LANES.map((state) => (
          <section className="min-h-64 min-w-64 rounded-lg border border-border bg-muted/40 p-4" aria-labelledby={`${state}-lane`} key={state}>
            <div className="flex items-center justify-between gap-3"><h2 id={`${state}-lane`} className="text-sm font-semibold capitalize">{state.replaceAll('_', ' ')}</h2><span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{byState.get(state).length}</span></div>
            <ul className="mt-4 space-y-3">{byState.get(state).map((task) => (
              <li key={task.taskId}><Link className="block rounded-lg border border-border bg-card p-4 transition hover:border-primary" href={`/tasks/${task.taskId}`}><p className="text-sm tabular-nums">{task.taskId}</p><p className="mt-2 text-xs text-muted-foreground">{task.projectId ? `Project ${task.projectId}` : 'Unassigned project'}</p>{taskType(task) && <span className="mt-3 mr-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{taskType(task)}</span>}{taskTag(task) && <span className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{taskTag(task)}</span>}{taskContextMode(task) && <p className="mt-3 text-xs text-muted-foreground">Context: {taskContextMode(task)}</p>}</Link></li>
            ))}</ul>
            {byState.get(state).length === 0 && <p className="mt-5 text-xs text-muted-foreground">No tasks in this lane.</p>}
          </section>
        ))}
        {unknown.length > 0 && <section className="min-h-64 min-w-64 rounded-lg border border-destructive/40 bg-destructive/5 p-4"><h2 className="text-sm font-semibold text-destructive">Unrecognized state</h2><ul className="mt-4 space-y-3">{unknown.map((task) => <li key={task.taskId} className="rounded-lg border border-border bg-card p-4 text-sm tabular-nums">{task.taskId}</li>)}</ul></section>}
      </div>}
    </PageContainer>
  );
}
