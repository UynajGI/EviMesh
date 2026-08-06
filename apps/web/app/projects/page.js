'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ projectId: '', name: '', summary: '', license: 'CC-BY-4.0' });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    fetch(`${API}/projects?limit=20`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Projects are unavailable.');
      setProjects(body.items ?? []);
    }).catch((reason) => setError(reason.message));
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault(); setError(null); setMessage(null);
    try {
      const { data } = await import('@/lib/supabase-browser').then(({ createBrowserSupabaseClient }) => createBrowserSupabaseClient().auth.getSession());
      const response = await fetch(`${API}/projects`, { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token ?? ''}`, 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Project creation failed.');
      setMessage('Project created as a draft.'); setForm({ projectId: '', name: '', summary: '', license: 'CC-BY-4.0' }); load();
    } catch (reason) { setError(reason.message); }
  }

  return <main className="mx-auto max-w-6xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Research spaces</p><div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-5xl font-semibold tracking-tight">Projects</h1><p className="mt-4 max-w-2xl text-muted-foreground">Explore projects or open a new evidence-backed research space.</p></div></div>
    <form onSubmit={submit} className="mt-10 grid gap-4 rounded-xl border border-border bg-card p-6 shadow-sm md:grid-cols-2"><h2 className="md:col-span-2 text-2xl font-semibold">Create a project</h2><input required aria-label="Project ID" className="rounded border border-border bg-background p-3" placeholder="Project ID" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} /><input required aria-label="Project name" className="rounded border border-border bg-background p-3" placeholder="Project name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><textarea required aria-label="Project summary" className="min-h-28 rounded border border-border bg-background p-3 md:col-span-2" placeholder="What is this project investigating?" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /><input required aria-label="Project license" className="rounded border border-border bg-background p-3" placeholder="License" value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} /><Button type="submit" className="md:w-fit">Create draft</Button>{message && <p className="text-sm text-primary md:col-span-2">{message}</p>}{error && <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p>}</form>
    <section className="mt-12 grid gap-4 md:grid-cols-2">{projects.map((project) => <Link className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary" href={`/projects/${project.projectId}`} key={project.projectId}><div className="flex items-center justify-between"><h2 className="font-semibold">{project.projectId}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize">{project.state}</span></div><p className="mt-3 text-sm text-muted-foreground">Open project details</p></Link>)}{projects.length === 0 && !error && <p className="text-sm text-muted-foreground">No projects have been published yet.</p>}</section>
  </main>;
}
