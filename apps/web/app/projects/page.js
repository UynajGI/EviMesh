'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { ActorName, Identifier, shortId } from '@/components/ui/doc';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const PROJECT_STATES = ['draft', 'active', 'archived'];

function stateVariant(state) {
  switch (state) {
    case 'active': return 'status-success';
    case 'archived': return 'status-neutral';
    default: return 'status-neutral';
  }
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return null;
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
    return <PageContainer><PageHeader title="Projects" /><ErrorState className="mt-8" message={error} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader action={<Link className="text-sm text-primary hover:underline" href="/agent">Open Agent connection</Link>} title="Projects" />

      <div className="mt-4 grid gap-4 border-b border-border pb-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="project-state">Status</Label><Select id="project-state" value={filters.state} onChange={updateFilter('state')}><option value="">All statuses</option>{PROJECT_STATES.map((state) => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}</Select></div>
        <div className="grid gap-2"><Label htmlFor="project-search">Search</Label><Input id="project-search" value={filters.search} onChange={updateFilter('search')} placeholder="Filter by project ID" /></div>
      </div>

      <section aria-labelledby="projects-heading" className="mt-8">
        <SectionHeader action={!loading ? <span className="tabular-nums text-muted-foreground">{visible.length}</span> : null} id="projects-heading" title="Research spaces" />
        {loading ? <Skeleton className="mt-4 h-96 w-full" /> : visible.length === 0 ? <Empty className="border-t-0" title={query ? 'No matching projects' : 'No projects yet'} /> : (
          <ul>
            {visible.map((project) => (
              <li className="ref-row" key={project.projectId}>
                <div><Badge variant={stateVariant(project.state)}>{project.state.replaceAll('_', ' ')}</Badge></div>
                <div className="min-w-0">
                  <Link className={project.title || project.name ? 'text-[0.9375rem] font-medium [overflow-wrap:anywhere] hover:underline' : 'font-mono text-sm tabular-nums hover:underline'} href={`/projects/${project.projectId}`} title={project.projectId}>{project.title ?? project.name ?? shortId(project.projectId)}</Link>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    {project.title || project.name ? <><Identifier value={project.projectId} />{project.createdBy ? <span aria-hidden="true">·</span> : null}</> : null}
                    {project.createdBy ? <><span>Opened by</span><ActorName actorId={project.createdBy} showOwner={false} /></> : null}
                  </p>
                </div>
                <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={project.createdAt} title={project.createdAt}>{relativeTime(project.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
