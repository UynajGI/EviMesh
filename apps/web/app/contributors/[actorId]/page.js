'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/data';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

/*
 * Public contributor page (M13.8 06-personal-ui-spec.md §1): identity,
 * contribution roles, and traceable activity. Roles and events only, never
 * points, rankings, or heatmaps.
 */
export default function ContributorDetailPage({ params }) {
  const [actorId, setActorId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { Promise.resolve(params).then(({ actorId: value }) => setActorId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const response = await fetch(`${API}/actors/${actorId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Contributor is unavailable.');
      setData(payload);
    } catch (reason) {
      setError(reason.message);
    }
  }

  useEffect(() => { if (actorId) load(); }, [actorId]);

  if (error) return <PageContainer><ErrorState message={error} onRetry={load} /></PageContainer>;
  if (!data) return <PageContainer><Skeleton className="h-24 w-full" /><Skeleton className="mt-6 h-64 w-full" /></PageContainer>;

  const actor = data.actor ?? data.profile ?? data;
  const list = (value) => Array.isArray(value) ? value : [];
  const roles = list(data.roles ?? actor.roles);
  const produced = list(data.produced ?? actor.produced);
  const used = list(data.used ?? actor.used);
  const frontierUsage = list(data.frontierUsage ?? data.frontiers);

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/explore">Explore</Link>
        <span aria-hidden="true">/</span>
        <Link className="hover:text-foreground" href="/contributions">Contributions</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{actor.displayName ?? actor.actorId ?? actorId}</span>
      </nav>

      <PageHeader
        description="Public contributor record: roles and traceable activity. No points, no rankings."
        eyebrow="Contributor"
        title={actor.displayName ?? actor.handle ?? 'EviMesh contributor'}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <IdChip label="actor" value={actor.actorId ?? actorId} />
        {typeof actor.orcidId === 'string' && actor.orcidId ? (
          <a className="font-mono text-xs text-muted-foreground hover:text-foreground" href={`https://orcid.org/${actor.orcidId}`} rel="noopener">orcid.org/{actor.orcidId}</a>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Roles</h2></div>
          {roles.length === 0 ? <CardContent><p className="text-sm text-muted-foreground">No recorded roles yet.</p></CardContent> : (
            <ul className="divide-y divide-border">
              {roles.map((role) => (
                <li className="px-5 py-3 text-sm" key={typeof role === 'string' ? role : role.role}>{typeof role === 'string' ? role.replaceAll('_', ' ') : JSON.stringify(role)}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Frontier usage</h2></div>
          <CardContent>
            {frontierUsage.length === 0 ? <p className="text-sm text-muted-foreground">No frontier membership recorded.</p> : (
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(frontierUsage, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Produced</h2></div>
          <CardContent>
            {produced.length === 0 ? <p className="text-sm text-muted-foreground">Nothing produced yet.</p> : (
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(produced, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Used</h2></div>
          <CardContent>
            {used.length === 0 ? <p className="text-sm text-muted-foreground">Nothing used yet.</p> : (
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(used, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
