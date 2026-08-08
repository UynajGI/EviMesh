'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label, Textarea } from '@/components/ui/form';
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

const BLANK_FORM = { projectId: '', name: '', summary: '', license: 'CC-BY-4.0' };

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ state: '', search: '' });
  const [form, setForm] = useState(BLANK_FORM);
  const [message, setMessage] = useState(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function submit(event) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const { data } = await import('@/lib/supabase-browser').then(({ createBrowserSupabaseClient }) => createBrowserSupabaseClient().auth.getSession());
      const response = await fetch(`${API}/projects`, { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token ?? ''}`, 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Project creation failed.');
      setMessage('Project created as a draft.');
      setForm(BLANK_FORM);
      load();
    } catch (reason) {
      setFormError(reason.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return <PageContainer><PageHeader eyebrow="Research spaces" title="Projects" description="Explore projects or open a new evidence-backed research space." /><ErrorState className="mt-8" message={error} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader eyebrow="Research spaces" title="Projects" description="Explore projects or open a new evidence-backed research space." />
      <form onSubmit={submit} className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2">
        <div className="md:col-span-2 grid gap-1"><h2 className="text-lg font-semibold">Create a project</h2><p className="text-sm text-muted-foreground">Drafts start private and become discoverable when activated.</p></div>
        <div className="grid gap-2"><Label htmlFor="project-id">Project ID</Label><Input id="project-id" required placeholder="short-kebab-id" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} /></div>
        <div className="grid gap-2"><Label htmlFor="project-name">Name</Label><Input id="project-name" required placeholder="Project name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
        <div className="grid gap-2 md:col-span-2"><Label htmlFor="project-summary">Summary</Label><Textarea id="project-summary" required className="min-h-24" placeholder="What is this project investigating?" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></div>
        <div className="grid gap-2"><Label htmlFor="project-license">License</Label><Input id="project-license" required placeholder="License" value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} /></div>
        <div className="flex items-end justify-end gap-3"><Button type="submit" loading={submitting}>Create draft</Button></div>
        {message ? <p className="text-sm text-primary md:col-span-2">{message}</p> : null}
        {formError ? <p role="alert" className="text-sm text-destructive md:col-span-2">{formError}</p> : null}
      </form>
      <div className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="project-state">Status</Label><Select id="project-state" value={filters.state} onChange={updateFilter('state')}><option value="">All statuses</option>{PROJECT_STATES.map((state) => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}</Select></div>
        <div className="grid gap-2"><Label htmlFor="project-search">Search</Label><Input id="project-search" value={filters.search} onChange={updateFilter('search')} placeholder="Filter by project ID" /></div>
      </div>
      {loading ? <Skeleton className="mt-10 h-96 w-full" /> : visible.length === 0 ? <Empty className="mt-10" title={query ? 'No projects match your search' : 'No projects yet'} description="Projects will appear here once research spaces are opened." /> : <div className="mt-10 grid gap-4 md:grid-cols-2">{visible.map((project) => <Link className="rounded-lg border border-border bg-card p-5 transition hover:border-primary" href={`/projects/${project.projectId}`} key={project.projectId}><div className="flex items-center justify-between gap-3"><h2 className="font-medium tabular-nums">{project.projectId}</h2><Badge variant={stateVariant(project.state)}>{project.state.replaceAll('_', ' ')}</Badge></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Open project details</p><time className="text-xs tabular-nums text-muted-foreground" dateTime={project.createdAt}>{relativeTime(project.createdAt)}</time></div></Link>)}</div>}
    </PageContainer>
  );
}
