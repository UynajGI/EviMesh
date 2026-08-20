'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, StatusBadge } from '@/components/ui/data';
import { RoleBar, CONTRIBUTION_ROLES } from '@/components/role-bar';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

/*
 * Public contributor page (M13.8 06-personal-ui-spec.md §1): identity,
 * contribution roles, and traceable activity. Roles and events only, never
 * points, rankings, or heatmaps.
 */

const PROJECT_HYDRATE_LIMIT = 6;

/* Readable list for detail arrays: scalar rows render as hairline list
   entries; anything richer collapses into a JSON details layer. */
function ReadableList({ value }) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;
  const scalars = items.filter((entry) => typeof entry === 'string' || typeof entry === 'number');
  if (scalars.length === items.length) {
    return (
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((entry, index) => <li className="px-4 py-2 text-sm" key={index}>{String(entry)}</li>)}
      </ul>
    );
  }
  return (
    <details>
      <summary className="cursor-pointer text-xs text-muted-foreground">{items.length} entries (technical details)</summary>
      <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
export default function ContributorDetailPage({ params }) {
  const [actorId, setActorId] = useState(null);
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => { Promise.resolve(params).then(({ actorId: value }) => setActorId(value)); }, [params]);

  async function load() {
    setError(null);
    try {
      const response = await fetch(`${API}/actors/${actorId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Contributor is unavailable.');
      setData(payload);
      /* Projects involved (mockup 参与的项目): derived from produced/used
       * attribution edges; titles live on the project detail endpoint. */
      const edges = [...(payload.produced ?? []), ...(payload.used ?? [])];
      const projectIds = [...new Set(edges.filter((edge) => edge.objectType === 'project').map((edge) => edge.objectId))].slice(0, PROJECT_HYDRATE_LIMIT);
      const projectRows = await Promise.all(projectIds.map(async (projectId) => {
        try {
          const detail = await (await fetch(`${API}/projects/${projectId}`)).json();
          return { projectId, name: detail?.project?.currentRevision?.name ?? null, state: detail?.project?.state ?? null, count: edges.filter((edge) => edge.objectType === 'project' && edge.objectId === projectId).length };
        } catch {
          return { projectId, name: null, state: null, count: edges.filter((edge) => edge.objectType === 'project' && edge.objectId === projectId).length };
        }
      }));
      setProjects(projectRows);
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
  const roleCounts = {};
  for (const role of roles) {
    const name = typeof role === 'string' ? role : role.role;
    if (CONTRIBUTION_ROLES.includes(name)) roleCounts[name] = (roleCounts[name] ?? 0) + 1;
  }
  const produced = list(data.produced ?? actor.produced);
  const used = list(data.used ?? actor.used);
  const frontierUsage = list(data.frontierUsage ?? data.frontiers);
  /* Signed contribution statements (mockup 公开贡献): role + description +
   * timestamp, newest first, bounded. Never scores, never ranked. */
  const statements = list(data.statements ?? actor.statements)
    .slice()
    .sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0))
    .slice(0, 12);

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/explore">Explore</Link>
        <span aria-hidden="true">/</span>
        <Link className="hover:text-foreground" href="/contributions">Contributions</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{actor.displayName ?? actor.actorId ?? actorId}</span>
      </nav>

      <header className="flex flex-wrap items-start gap-5">
        <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-xl font-semibold text-accent-foreground">
          {(actor.displayName ?? actor.actorId ?? actorId).slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contributor</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{actor.displayName ?? actor.handle ?? 'EviMesh contributor'}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <IdChip label="actor" value={actor.actorId ?? actorId} />
            {typeof actor.orcidId === 'string' && actor.orcidId ? (
              <a className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground" href={`https://orcid.org/${actor.orcidId}`} rel="noopener">
                {/* ORCID iD mark. No verified badge: verification status is not
                    carried by the actors API, and an unverified iD must never
                    render as verified (hard boundary). */}
                <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-status-success-bg text-[8px] font-bold text-status-success-fg">iD</span>
                orcid.org/{actor.orcidId}
              </a>
            ) : null}
          </div>
        </div>
      </header>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">Public contributor record: roles and traceable activity. No points, no rankings.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Roles</h2></div>
          <CardContent>
            {roles.length === 0 ? <p className="text-sm text-muted-foreground">No recorded roles yet.</p> : (
              <>
                <RoleBar counts={roleCounts} />
                <ul className="mt-4 flex flex-wrap gap-2">
                  {roles.map((role, index) => {
                    const name = typeof role === 'string' ? role : role.role;
                    return <li key={`${name}-${index}`}><StatusBadge label={name} state={CONTRIBUTION_ROLES.includes(name) ? name : 'contributor'} /></li>;
                  })}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Frontier usage</h2></div>
          <CardContent>
            <ReadableList value={frontierUsage} />
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Produced</h2></div>
          <CardContent>
            <ReadableList value={produced} />
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Used</h2></div>
          <CardContent>
            <ReadableList value={used} />
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="contributions-heading" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight" id="contributions-heading">Public contributions</h2>
          <span className="text-sm text-muted-foreground">By role and time; never ranked, never scored</span>
        </div>
        {statements.length === 0 ? (
          <Empty title="No signed contributions yet" description="Signed contribution statements appear here as this contributor records protocol events." />
        ) : (
          <ol className="divide-y divide-border rounded-lg border border-border bg-card">
            {statements.map((statement) => (
              <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 px-5 py-3.5" key={statement.statementId}>
                <span aria-hidden="true" className="mt-0.5 grid size-8 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {(statement.role ?? 'role').slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm">{statement.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge label={statement.role ?? 'contributor'} state={CONTRIBUTION_ROLES.includes(statement.role) ? statement.role : 'contributor'} />
                    <span className="font-mono tabular-nums">{statement.statementId}</span>
                    <span className="tabular-nums">{statement.createdAt ? new Date(statement.createdAt).toISOString().slice(0, 10) : 'time unavailable'}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Projects involved</h2></div>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No project-linked attribution recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {projects.map((project) => (
                  <li key={project.projectId}>
                    <Link className="flex flex-wrap items-baseline gap-2 px-4 py-3 hover:bg-muted/50" href={`/projects/${project.projectId}`}>
                      <span className="text-sm font-medium">{project.name ?? project.projectId}</span>
                      {project.state ? <StatusBadge label="project" state={project.state} /> : null}
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">{project.count} linked object{project.count === 1 ? '' : 's'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agents acting for this contributor</h2></div>
          <CardContent>
            <Empty
              description="Agents acting on this contributor's behalf appear here with their attribution chain, declared model, scope, and key fingerprint once the agent registry is exposed through the public API."
              title="No agent registry exposed yet"
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
