'use client';

import { useEffect, useState } from 'react';

const CLOSED_STATES = new Set(['resolved', 'archived', 'rejected']);

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Activity time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HomePage() {
  const [questions, setQuestions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [frontiers, setFrontiers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/questions?limit=20`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? 'Questions are unavailable.');
        return payload.items ?? [];
      })
      .then((items) => setQuestions(items.filter((question) => !CLOSED_STATES.has(question.state)).sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0)).slice(0, 6)))
      .catch((reason) => setError(reason.message));
  }, []);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/projects?limit=6`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Projects are unavailable.');
      return payload.items ?? [];
    }).then((projects) => Promise.all(projects.map(async (project) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/projects/${project.projectId}/frontier/latest`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Frontiers are unavailable.');
      return payload.frontier ? { project, frontier: payload.frontier } : null;
    }))).then((items) => setFrontiers(items.filter(Boolean))).catch((reason) => setError(reason.message));
  }, []);

  useEffect(() => {
    Promise.all(['under_verification', 'provisionally_accepted'].map((status) => fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/claims?status=${status}&limit=6`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Claims are unavailable.');
      return payload.items ?? [];
    })))
      .then((groups) => setClaims(groups.flat().sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0)).slice(0, 6)))
      .catch((reason) => setError(reason.message));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-24 text-foreground">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">EviMesh</p>
      <h1 className="mt-3 text-5xl font-semibold tracking-tight sm:text-7xl">Open distributed scientific network.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">A transparent workspace for research questions, evidence, verification, and shared scientific progress.</p>
      <section className="mt-16" aria-labelledby="open-questions-heading">
        <div className="flex items-baseline justify-between gap-6"><div><p className="text-sm font-semibold text-primary">Research now</p><h2 id="open-questions-heading" className="mt-2 text-3xl font-semibold">Open questions</h2></div><span className="text-sm text-muted-foreground">Newest activity first</span></div>
        {error ? <p className="mt-6 text-sm text-muted-foreground">{error}</p> : <div className="mt-6 grid gap-4 md:grid-cols-2">{questions.map((question) => <article className="rounded-xl border border-border bg-card p-5 shadow-sm" key={question.questionId}><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">{question.state}</span><time className="text-xs text-muted-foreground" dateTime={question.createdAt}>{relativeTime(question.createdAt)}</time></div><h3 className="mt-4 font-semibold">{question.questionId}</h3><p className="mt-2 text-sm text-muted-foreground">Project {question.projectId}</p></article>)}</div>}
        {!error && questions.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No open questions have been published yet.</p>}
      </section>
      <section className="mt-16" aria-labelledby="verification-claims-heading">
        <div><p className="text-sm font-semibold text-primary">Evidence in motion</p><h2 id="verification-claims-heading" className="mt-2 text-3xl font-semibold">Claims awaiting verification</h2></div>
        {error ? null : <div className="mt-6 grid gap-4 md:grid-cols-2">{claims.map((claim) => <article className="rounded-xl border border-border bg-card p-5 shadow-sm" key={claim.claimId}><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">{claim.state.replaceAll('_', ' ')}</span><h3 className="mt-4 font-semibold">{claim.claimId}</h3><p className="mt-2 text-sm text-muted-foreground">Question {claim.questionId ?? 'not linked'}</p></article>)}</div>}
        {!error && claims.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No claims are currently awaiting verification.</p>}
      </section>
      <section className="mt-16" aria-labelledby="frontier-heading">
        <div><p className="text-sm font-semibold text-primary">Established knowledge</p><h2 id="frontier-heading" className="mt-2 text-3xl font-semibold">Latest frontiers</h2></div>
        {error ? null : <div className="mt-6 grid gap-4 md:grid-cols-2">{frontiers.map(({ project, frontier }) => <article className="rounded-xl border border-border bg-card p-5 shadow-sm" key={frontier.snapshotId}><p className="text-sm text-muted-foreground">Project {project.projectId}</p><h3 className="mt-3 text-xl font-semibold">Frontier #{frontier.sequence}</h3><p className="mt-2 text-sm text-muted-foreground">Snapshot {frontier.snapshotId}</p></article>)}</div>}
        {!error && frontiers.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No published frontiers yet.</p>}
      </section>
    </main>
  );
}
