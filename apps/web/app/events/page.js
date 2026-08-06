'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

export default function EventsAuditPage() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => { fetch(`${API}/events?limit=100`).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message ?? 'Event audit is unavailable.'); setEvents(payload.items ?? []); }).catch((reason) => setError(reason.message)); }, []);
  if (error) return <main className="mx-auto max-w-6xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  return <main className="mx-auto max-w-6xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Trust layer</p><h1 className="mt-3 text-5xl font-semibold tracking-tight">Event audit</h1><p className="mt-4 max-w-2xl text-muted-foreground">Inspect signed ResearchEvents and their immutable parent hash chain.</p><section className="mt-10 space-y-4">{events.map((event) => <article className="rounded-xl border border-border bg-card p-5" key={event.eventId}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-mono text-sm">{event.eventId}</h2><span className="rounded-full bg-muted px-2 py-1 text-xs">{event.eventType}</span></div><dl className="mt-4 grid gap-3 text-sm md:grid-cols-2"><div><dt className="text-muted-foreground">Hash</dt><dd className="mt-1 break-all font-mono text-xs">{event.hash ?? 'Missing'}</dd></div><div><dt className="text-muted-foreground">Signature</dt><dd className="mt-1 break-all font-mono text-xs">{typeof event.signature === 'object' ? JSON.stringify(event.signature) : event.signature ?? 'Missing'}</dd></div><div><dt className="text-muted-foreground">Parents</dt><dd className="mt-1 font-mono text-xs">{(event.parents ?? []).join(', ') || 'Genesis event'}</dd></div><div><dt className="text-muted-foreground">Created</dt><dd className="mt-1">{event.createdAt ?? 'Unknown'}</dd></div></dl></article>)}{events.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">No ResearchEvents are available.</p>}</section></main>;
}
