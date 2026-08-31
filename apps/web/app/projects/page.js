'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const PROJECT_STATES = ['draft', 'active', 'archived'];

function stateVariant(state) {
  switch (state) {
    case 'active': return 'success';
    case 'archived': return 'default';
    default: return 'default';
  }
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Activity time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ state: '', search: '' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ limit: '100' });
      if (filters.state) query.set('state', filters.state);
      const response = await fetch(`${API}/projects?${query.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Projects are unavailable.');
      setProjects(body.items ?? []);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filters.state]);

  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const query = filters.search.trim().toLowerCase();
  const visible = query ? projects.filter((project) => (project.projectId ?? '').toLowerCase().includes(query)) : projects;

  if (error) {
    return <PageContainer><PageHeader eyebrow="Research spaces" title="Projects" description="Browse the attributable project record." /><ErrorState className="mt-8" message={error} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader eyebrow="Research spaces" title="Projects" description="Browse the attributable project record by state and stable ID." />
      <section className="mt-8 grid min-w-0 grid-cols-12 border-y border-foreground py-5"><p className="col-span-12 font-mono text-[10px] font-bold uppercase text-primary sm:col-span-3">READ-ONLY WEB</p><p className="col-span-12 mt-3 max-w-[60ch] text-sm leading-6 text-muted-foreground sm:col-span-6 sm:mt-0">Project creation and research transitions happen through CLI or MCP. Human-controlled signing remains local.</p><Link className="col-span-12 mt-4 inline-flex min-h-11 items-center justify-center border border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary sm:col-span-3 sm:mt-0" href="/agent">Open Agent connection</Link></section>
      <div className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="project-state">Status</Label><Select id="project-state" value={filters.state} onChange={updateFilter('state')}><option value="">All statuses</option>{PROJECT_STATES.map((state) => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}</Select></div>
        <div className="grid gap-2"><Label htmlFor="project-search">Search</Label><Input id="project-search" value={filters.search} onChange={updateFilter('search')} placeholder="Filter by project ID" /></div>
      </div>
      {loading ? <Skeleton className="mt-10 h-96 w-full" /> : visible.length === 0 ? <Empty className="mt-10" title={query ? 'No projects match your search' : 'No projects yet'} description="Projects will appear here once research spaces are opened." /> : <div className="mt-10 grid gap-4 md:grid-cols-2">{visible.map((project) => <Link className="rounded-lg border border-border bg-card p-5 transition hover:border-primary" href={`/projects/${project.projectId}`} key={project.projectId}><div className="flex items-center justify-between gap-3"><h2 className="font-medium tabular-nums">{project.projectId}</h2><Badge variant={stateVariant(project.state)}>{project.state.replaceAll('_', ' ')}</Badge></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Open project details</p><time className="text-xs tabular-nums text-muted-foreground" dateTime={project.createdAt}>{relativeTime(project.createdAt)}</time></div></Link>)}</div>}
    </PageContainer>
  );
}
