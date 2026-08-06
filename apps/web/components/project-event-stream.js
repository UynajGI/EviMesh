'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

export function ProjectEventStream({ projectId }) {
  const [events, setEvents] = useState([]);
  const [state, setState] = useState('connecting');
  useEffect(() => {
    if (!projectId || typeof EventSource === 'undefined') return undefined;
    let source;
    let retry;
    let closed = false;
    const connect = () => {
      if (closed) return;
      setState('connecting');
      source = new EventSource(`${API}/projects/${projectId}/events/stream`);
      source.onopen = () => setState('connected');
      source.onmessage = (message) => { try { setEvents((current) => [JSON.parse(message.data), ...current].slice(0, 20)); } catch { setState('invalid event'); } };
      source.onerror = () => { source.close(); setState('reconnecting'); retry = window.setTimeout(connect, 3000); };
    };
    connect();
    return () => { closed = true; source?.close(); window.clearTimeout(retry); };
  }, [projectId]);
  return <section aria-label="Project live events" className="mt-12 rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Live project events</h2><span className="text-xs text-muted-foreground">{state}</span></div>{events.length ? <ul className="mt-4 space-y-2">{events.map((event, index) => <li className="rounded border border-border p-3 font-mono text-xs" key={`${event.eventId ?? 'event'}-${index}`}>{JSON.stringify(event)}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Waiting for project events…</p>}</section>;
}
