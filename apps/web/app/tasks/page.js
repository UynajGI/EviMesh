'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { shortId } from '@/components/ui/doc';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
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
    <div className="mt-4 grid gap-4 border-b border-border pb-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="grid gap-2"><Label htmlFor="task-type">Type</Label><Select id="task-type" value={filters.type} onChange={updateFilter('type')}><option value="">All types</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="task-status">Status</Label><Select id="task-status" value={filters.status} onChange={updateFilter('status')}><option value="">All statuses</option>{LANES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="task-tag">Tag</Label><Input id="task-tag" value={filters.tag} onChange={updateFilter('tag')} placeholder="Filter by tag" /></div>
      <div className="grid gap-2"><Label htmlFor="task-mode">Context mode</Label><Select id="task-mode" value={filters.contextMode} onChange={updateFilter('contextMode')}><option value="">All context modes</option>{CONTEXT_MODES.map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>)}</Select></div>
    </div>
  );

  if (error) {
    return <PageContainer><PageHeader title="Tasks" /><ErrorState className="mt-8" message={error} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader title="Tasks" />
      {loading ? <Skeleton className="mt-4 h-16 w-full" /> : filtersPanel}
      {loading ? <Skeleton className="mt-8 h-96 w-full" /> : <div className="mt-8 grid gap-x-6 gap-y-8 overflow-x-auto pb-4 lg:grid-cols-4">
        {LANES.map((state) => (
          <section className="min-w-64" aria-labelledby={`${state}-lane`} key={state}>
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5"><h2 id={`${state}-lane`} className="text-sm font-semibold first-letter:uppercase">{state.replaceAll('_', ' ')}</h2><span className="text-xs tabular-nums text-muted-foreground">{byState.get(state).length}</span></div>
            <ul>{byState.get(state).map((task) => (
              <li className="border-b border-border py-2.5" key={task.taskId}>
                <Link className="block font-mono text-sm hover:underline" href={`/tasks/${task.taskId}`} title={task.taskId}>{shortId(task.taskId)}</Link>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  {task.projectId ? <Link className="font-mono hover:text-foreground hover:underline" href={`/projects/${encodeURIComponent(task.projectId)}`} title={task.projectId}>{shortId(task.projectId)}</Link> : null}
                  {taskType(task) ? <span>{taskType(task)}</span> : null}
                  {taskTag(task) ? <span>{taskTag(task)}</span> : null}
                  {taskContextMode(task) ? <span>{taskContextMode(task).replaceAll('_', ' ')}</span> : null}
                </p>
              </li>
            ))}</ul>
            {byState.get(state).length === 0 && <p className="py-2.5 text-xs text-muted-foreground">None</p>}
          </section>
        ))}
        {unknown.length > 0 && <section className="min-w-64" aria-labelledby="unknown-lane"><h2 className="border-b border-border pb-1.5 text-sm font-semibold text-destructive" id="unknown-lane">Unrecognized state</h2><ul>{unknown.map((task) => <li key={task.taskId} className="border-b border-border py-2.5 font-mono text-sm"><Link className="hover:underline" href={`/tasks/${task.taskId}`} title={task.taskId}>{shortId(task.taskId)}</Link></li>)}</ul></section>}
      </div>}
    </PageContainer>
  );
}
