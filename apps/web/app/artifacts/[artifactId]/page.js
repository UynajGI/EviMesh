'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

export default function ArtifactDetailPage({ params }) {
  const [artifactId, setArtifactId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ artifactId: value }) => setArtifactId(value)); }, [params]);
  useEffect(() => {
    if (!artifactId) return;
    fetch(`${API}/artifacts/${artifactId}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Artifact is unavailable.');
      setData(payload);
    }).catch((reason) => setError(reason.message));
  }, [artifactId]);
  if (error) return <main className="mx-auto max-w-5xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-5xl px-6 py-16" aria-busy="true">Loading artifact…</main>;
  const { artifact, currentRevision, locations = [] } = data;
  return <main className="mx-auto max-w-5xl px-6 py-16"><Link className="text-sm text-primary hover:underline" href="/artifacts/upload">← Upload another artifact</Link><p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">Evidence artifact</p><h1 className="mt-3 font-mono text-3xl font-semibold">{artifact.artifactId}</h1><div className="mt-8 grid gap-4 sm:grid-cols-3"><section className="rounded-xl border border-border bg-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Hash</p><p className="mt-3 break-all font-mono text-sm">{currentRevision.rawHash ?? artifact.rawHash ?? 'Not verified'}</p></section><section className="rounded-xl border border-border bg-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">License</p><p className="mt-3">{currentRevision.license ?? artifact.license ?? 'Not specified'}</p></section><section className="rounded-xl border border-border bg-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Size</p><p className="mt-3">{currentRevision.sizeBytes ?? artifact.sizeBytes ?? 'Unknown'} bytes</p></section></div><section className="mt-8 rounded-xl border border-border bg-card p-5"><h2 className="text-xl font-semibold">Locations</h2>{locations.length ? <ul className="mt-4 space-y-3">{locations.map((location, index) => <li className="rounded border border-border p-3 text-sm" key={`${location.locationId ?? location.uri ?? index}`}><p className="font-mono break-all">{location.uri ?? location.url ?? location.key ?? JSON.stringify(location)}</p><p className="mt-1 text-muted-foreground">{location.visibility ?? 'visibility unspecified'}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No storage locations are registered.</p>}</section></main>;
}
