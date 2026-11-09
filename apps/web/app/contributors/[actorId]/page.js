'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/data';
import { RoleDirectory, CONTRIBUTION_ROLES } from '@/components/role-directory';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb, SectionHeader } from '@/components/ui/page';
import { Identifier, MarginSection, TitleBlock, formatDate, shortId } from '@/components/ui/doc';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

/*
 * Public contributor page (M13.8 06-personal-ui-spec.md §1) in the
 * research-record grammar: the name and one byline, then signed
 * contributions and attributed objects as ref-rows. Roles and events only,
 * never public competition metrics or heatmaps.
 */

const PROJECT_HYDRATE_LIMIT = 6;

function readable(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

const EDGE_ROUTES = Object.freeze({
  claim: '/claims', question: '/questions', project: '/projects', task: '/tasks', attempt: '/attempts', artifact: '/artifacts',
  answer: '/answers', rebuttal: '/rebuttals', evaluation: '/evaluations', evidence: '/evidence', dataset: '/datasets', run: '/runs', tool: '/tools',
});

function edgeHref(edge) {
  const prefix = EDGE_ROUTES[edge.objectType];
  if (!prefix) return null;
  const revision = Number(edge.objectRevision);
  return `${prefix}/${encodeURIComponent(edge.objectId)}${edge.objectType === 'claim' && Number.isInteger(revision) && revision > 0 ? `?rev=${revision}` : ''}`;
}

/* Readable list for detail arrays: attribution edges and scalar rows render
   as ruled entries; anything richer collapses into a JSON details layer. */
function ReadableList({ value }) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return <p className="clause__none mt-3">None yet.</p>;
  const scalars = items.filter((entry) => typeof entry === 'string' || typeof entry === 'number');
  if (scalars.length === items.length) {
    return (
      <ul className="mt-1">
        {items.map((entry, index) => <li className="border-b border-border py-1.5 text-[13px]" key={index}>{String(entry)}</li>)}
      </ul>
    );
  }
  const edges = items.filter((entry) => entry && typeof entry === 'object' && entry.objectType && entry.objectId);
  if (edges.length === items.length) {
    return (
      <ul>
        {edges.slice(0, 12).map((edge, index) => {
          const href = edgeHref(edge);
          const label = <>{readable(edge.objectType)} <span className="font-mono text-xs text-muted-foreground">{shortId(edge.objectId)}</span></>;
          return (
            <li className="ref-row" key={`${edge.objectType}-${edge.objectId}-${index}`}>
              <p className="text-sm text-muted-foreground">{readable(edge.edgeType ?? edge.objectType)}</p>
              <div className="min-w-0 text-sm">{href ? <Link className="hover:underline" href={href} title={edge.objectId}>{label}</Link> : <span title={edge.objectId}>{label}</span>}</div>
              <span className="text-xs tabular-nums text-muted-foreground md:text-right">{edge.objectRevision ? `r${edge.objectRevision}` : ''}</span>
            </li>
          );
        })}
        {edges.length > 12 ? <li className="py-2 text-xs text-muted-foreground">Newest 12 of {edges.length}</li> : null}
      </ul>
    );
  }
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[13px] text-muted-foreground">{items.length} entries</summary>
      <pre className="mt-2 overflow-x-auto border border-border bg-muted p-3 font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>
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
      /* Projects involved: derived from produced/used attribution edges;
       * titles live on the project detail endpoint. */
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

  if (error) return <div className="doc-page pb-20 pt-10"><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return <div className="doc-page pb-20 pt-8"><Skeleton className="h-4 w-64" /><Skeleton className="mt-5 h-48 w-full" /><Skeleton className="mt-8 h-64 w-full" /></div>;

  const actor = data.actor ?? data.profile ?? data;
  const list = (value) => Array.isArray(value) ? value : [];
  const roles = list(data.roles ?? actor.roles);
  const produced = list(data.produced ?? actor.produced);
  const used = list(data.used ?? actor.used);
  const frontierUsage = list(data.frontierUsage ?? data.frontiers);
  /* Signed contribution statements: role + description + timestamp, newest
   * first, bounded. */
  const statements = list(data.statements ?? actor.statements)
    .slice()
    .sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0))
    .slice(0, 12);
  const name = actor.displayName ?? actor.handle ?? 'EviMesh contributor';

  return (
    <div className="doc-page pb-20 pt-5 sm:pt-6">
      <Breadcrumb
        trail={[
          { label: 'Explore', href: '/explore' },
          { label: 'Contributions', href: '/contributions' },
          { label: actor.displayName ?? 'Contributor' },
        ]}
      />

      <TitleBlock
        cells={[
          { label: 'Affiliation', bare: true, value: actor.affiliation ?? null },
          {
            label: 'ORCID iD',
            /* Hard boundary (design book 06, AGENTS.md): the official iD mark
               requires per-iD OAuth provenance, which the actors API does not
               carry yet - account-level identityStrength does not prove this
               iD was verified. Until that provenance exists, the iD renders
               as a plain identifier link and never as verified. */
            bare: true,
            value: typeof actor.orcidId === 'string' && actor.orcidId ? (
              <a className="break-all font-mono text-xs hover:text-primary hover:underline" href={`https://orcid.org/${actor.orcidId}`} rel="noopener">orcid.org/{actor.orcidId}</a>
            ) : null,
          },
          { label: 'Since', value: formatDate(actor.createdAt) ? <span className="tabular-nums">{formatDate(actor.createdAt)}</span> : null },
          { label: 'Identifier', bare: true, value: <Identifier value={actor.actorId ?? actorId} /> },
        ]}
        kind="Contributor"
        notice={actor.bio ? <p className="max-w-[68ch] text-[15px] leading-7 text-muted-foreground">{actor.bio}</p> : null}
        serif={false}
        title={name}
      />

      <div className="doc-grid mt-6">
        <div className="doc-main grid gap-8">
          <section aria-labelledby="contributions-heading">
            <SectionHeader action={statements.length > 0 ? <span className="tabular-nums text-muted-foreground">{statements.length}</span> : null} id="contributions-heading" title="Signed contributions" />
            {statements.length === 0 ? (
              <p className="clause__none mt-3">None yet.</p>
            ) : (
              <ol>
                {statements.map((statement) => (
                  <li className="ref-row" key={statement.statementId}>
                    <div><StatusBadge label={statement.role ?? 'contributor'} state={CONTRIBUTION_ROLES.includes(statement.role) ? statement.role : 'contributor'} /></div>
                    <div className="min-w-0">
                      <p className="text-sm leading-6">{statement.description}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground" title={statement.statementId}>{shortId(statement.statementId)}</p>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground md:text-right">{formatDate(statement.createdAt) ?? ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="projects-heading">
            <SectionHeader id="projects-heading" title="Projects" />
            {projects.length === 0 ? (
              <p className="clause__none mt-3">None yet.</p>
            ) : (
              <ul>
                {projects.map((project) => (
                  <li className="ref-row" key={project.projectId}>
                    <div>{project.state ? <StatusBadge label="project" state={project.state} /> : <p className="text-sm text-muted-foreground">Project</p>}</div>
                    <div className="min-w-0">
                      <Link className="text-sm font-medium hover:underline" href={`/projects/${project.projectId}`}>{project.name ?? shortId(project.projectId)}</Link>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground md:text-right">{project.count} linked object{project.count === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="produced-heading">
            <SectionHeader action={produced.length > 0 ? <span className="tabular-nums text-muted-foreground">{produced.length}</span> : null} id="produced-heading" title="Produced" />
            <ReadableList value={produced} />
          </section>

          <section aria-labelledby="used-heading">
            <SectionHeader action={used.length > 0 ? <span className="tabular-nums text-muted-foreground">{used.length}</span> : null} id="used-heading" title="Used" />
            <ReadableList value={used} />
          </section>
        </div>

        <aside aria-label="Contributor roles and agents" className="doc-margin">
          <MarginSection title="Roles">
            {roles.length === 0 ? <p className="text-[13px] text-muted-foreground">None yet</p> : <RoleDirectory roles={roles} />}
          </MarginSection>

          {frontierUsage.length > 0 ? (
            <MarginSection title="Frontier usage">
              <ReadableList value={frontierUsage} />
            </MarginSection>
          ) : null}

          <MarginSection title="Record">
            <Link className="text-[13px] text-primary hover:underline" href={`/events?actorId=${encodeURIComponent(actor.actorId ?? actorId)}`}>Event audit</Link>
          </MarginSection>
        </aside>
      </div>
    </div>
  );
}
