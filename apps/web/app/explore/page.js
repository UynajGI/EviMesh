'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
import { Card, StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { HandoffSheet } from '@/components/handoff-sheet';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils';

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'question', label: 'Questions' },
  { id: 'project', label: 'Projects' },
  { id: 'claim', label: 'Claims' },
  { id: 'researcher', label: 'Researchers' },
];

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `${path} is unavailable.`);
  return payload;
}

/* List rows carry no revision fields (titles live on detail endpoints), so
 * the first HYDRATE_LIMIT result rows get their real title/statement; rows
 * beyond the bound fall back to the id line. Bounded, real data only. */
const HYDRATE_LIMIT = 12;

async function hydrateTitle(item) {
  try {
    if (item.kind === 'question') {
      const detail = await fetchJson(`/questions/${item.id}`);
      return detail.currentRevision?.title ?? null;
    }
    if (item.kind === 'claim') {
      const detail = await fetchJson(`/claims/${item.id}`);
      const statement = detail.currentRevision?.statement ?? null;
      return statement ? `${statement.slice(0, 90)}${statement.length > 90 ? '…' : ''}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchList(path) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `${path} is unavailable.`);
  return payload.items ?? [];
}

/*
 * Explore (M13.8 05-core-ui-spec.md §3): one search entry. Object types are
 * filter dimensions, never a navigation layer. No popularity ordering:
 * sorting expresses recency, never research value. The initial query can
 * arrive from the command palette via ?q=.
 */
function ExploreView() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('recent');
  const [last30, setLast30] = useState(false);
  const [rowHandoff, setRowHandoff] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [questions, projects, claims] = await Promise.all([
        fetchList('/questions?limit=50'),
        fetchList('/projects?limit=50'),
        fetchList('/claims?limit=50'),
      ]);
      const base = [
        ...questions.map((question) => ({ kind: 'question', id: question.questionId, state: question.state, when: question.createdAt, projectId: question.projectId })),
        ...projects.map((project) => ({ kind: 'project', id: project.projectId, state: project.state ?? 'active', when: project.createdAt })),
        ...claims.map((claim) => ({ kind: 'claim', id: claim.claimId, state: claim.state, when: claim.createdAt, questionId: claim.questionId, createdBy: claim.createdBy })),
      ];
      setItems(base);
      const heads = await Promise.all(base.slice(0, HYDRATE_LIMIT).map(async (item) => ({ ...item, title: await hydrateTitle(item) })));
      setItems([...heads, ...base.slice(HYDRATE_LIMIT)]);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { document.title = 'Explore · EviMesh'; }, []);

  /* Date-window filter (mockup 筛选：近 30 天): applied client-side to the
   * loaded page of results; it never invents items outside the loaded set. */
  const windowed = useMemo(() => {
    if (!last30) return items;
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return items.filter((item) => !item.when || Date.parse(item.when) >= since);
  }, [items, last30]);

  /* Researchers are derived from the createdBy attribution already present on
   * questions and claims (mockup 研究者 tab). There is no actor directory
   * endpoint yet, so this stays a derived, bounded view of current results. */
  const researchers = useMemo(() => {
    const byActor = new Map();
    for (const item of windowed) {
      const actor = item.createdBy;
      if (!actor) continue;
      const entry = byActor.get(actor) ?? { actorId: actor, count: 0, lastWhen: null };
      entry.count += 1;
      if (!entry.lastWhen || Date.parse(item.when ?? 0) > Date.parse(entry.lastWhen)) entry.lastWhen = item.when;
      byActor.set(actor, entry);
    }
    /* Recency order, never contribution counts: counts stay navigation aids. */
    return [...byActor.values()].sort((left, right) => Date.parse(right.lastWhen ?? 0) - Date.parse(left.lastWhen ?? 0));
  }, [windowed]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (type === 'researcher') {
      return researchers.filter((entry) => !needle || entry.actorId.toLowerCase().includes(needle)).slice(0, 40);
    }
    return windowed
      .filter((item) => (type === 'all' || item.kind === type))
      .filter((item) => !needle || item.id.toLowerCase().includes(needle) || (item.projectId ?? '').toLowerCase().includes(needle))
      .sort((left, right) => {
        if (sort === 'title') return String(left.title ?? left.id).localeCompare(String(right.title ?? right.id));
        return Date.parse(right.when ?? 0) - Date.parse(left.when ?? 0);
      })
      .slice(0, 40);
  }, [windowed, researchers, query, type, sort]);

  const hrefFor = (item) => (item.kind === 'question' ? `/questions/${item.id}` : item.kind === 'project' ? `/projects/${item.id}` : `/claims/${item.id}`);

  return (
    <PageContainer>
      <PageHeader
        description="One search across questions, projects, and claims. Object types are filters here, not navigation."
        eyebrow="Explore"
        title="Discover research"
      />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          aria-label="Search research"
          className="h-11 w-full max-w-md rounded-md border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by stable id or project"
          type="search"
          value={query}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Result type">
            {TYPES.map((entry) => {
              const total = entry.id === 'all' ? windowed.length : entry.id === 'researcher' ? researchers.length : windowed.filter((item) => item.kind === entry.id).length;
              return (
                <button
                  aria-selected={type === entry.id}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors',
                    type === entry.id ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                  key={entry.id}
                  onClick={() => setType(entry.id)}
                  role="tab"
                  type="button"
                >
                  {entry.label}
                  <span className="rounded-full border border-border bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">{total}</span>
                </button>
              );
            })}
          </div>
          <button
            aria-pressed={last30}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors',
              last30 ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setLast30((value) => !value)}
            type="button"
          >
            Last 30 days
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
        <div className="min-w-0">
          {loading ? (
            <div className="grid gap-3">{[0, 1, 2].map((key) => <Skeleton className="h-16 w-full" key={key} />)}</div>
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : results.length === 0 ? (
            <Empty
              action={(
                <button className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" onClick={() => { setQuery(''); setType('all'); }} type="button">
                  Clear filters
                </button>
              )}
              description="No objects match the current search and filters. Try a shorter stable id or another type."
              title="Nothing matches yet"
            />
          ) : type === 'researcher' ? (
            <Card className="divide-y divide-border">
              {results.map((entry) => (
                <article className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted/50" key={entry.actorId}>
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {entry.actorId.slice(0, 1).toUpperCase()}
                  </span>
                  <Link className="min-w-0 flex-1 truncate font-medium hover:underline" href={`/contributors/${encodeURIComponent(entry.actorId)}`}>{entry.actorId}</Link>
                  <span className="text-xs tabular-nums text-muted-foreground">{entry.count} linked object{entry.count === 1 ? '' : 's'}</span>
                  <Link className="text-xs font-medium text-primary hover:underline" href={`/contributors/${encodeURIComponent(entry.actorId)}`}>open</Link>
                </article>
              ))}
              <p className="px-5 py-3 text-xs text-muted-foreground">Derived from attribution on the currently loaded questions and claims. Object counts are entry points, never contribution scores.</p>
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {results.map((item) => (
                <article className="grid gap-1.5 px-5 py-4 hover:bg-muted/50" key={`${item.kind}-${item.id}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge label={item.kind} state={item.state} />
                    {item.title ? (
                      <Link className="min-w-0 flex-1 truncate text-base font-semibold hover:underline" href={hrefFor(item)}>{item.title}</Link>
                    ) : (
                      <IdChip className="min-w-0 flex-1" value={item.id} />
                    )}
                    <Link className="text-xs font-medium text-primary hover:underline" href={hrefFor(item)}>open</Link>
                    <button className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setRowHandoff(item)} type="button">Hand to agent</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <IdChip value={item.id} />
                    {item.createdBy ? <Link className="hover:text-foreground" href={`/contributors/${encodeURIComponent(item.createdBy)}`}>by {item.createdBy}</Link> : null}
                    {item.projectId ? <span className="tabular-nums">project {item.projectId}</span> : null}
                    {item.when ? (
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock aria-hidden="true" size={12} />
                        {new Date(item.when).toISOString().slice(0, 10)}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </Card>
          )}
          {!loading && !error ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Ordered by recent activity. Sorting never expresses research value or support.
            </p>
          ) : null}
        </div>

        <aside aria-label="Ordering" className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order by</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {[
              ['recent', 'Recent activity'],
              ['title', 'Title order'],
            ].map(([value, labelText]) => (
              <label className="flex items-center gap-2" key={value}>
                <input
                  checked={sort === value}
                  className="accent-[var(--evimesh-primary)]"
                  name="explore-sort"
                  onChange={() => setSort(value)}
                  type="radio"
                  value={value}
                />
                {labelText}
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No popularity ordering exists: sorting expresses recency, never research value.</p>
        </aside>
      </div>
      {rowHandoff ? (
        <HandoffSheet
          cliCommand={rowHandoff.kind === 'question'
            ? `sq question list   # locate ${rowHandoff.id}`
            : `sq provenance ${rowHandoff.id}   # inspect the dependency path`}
          intent={`Continue this ${rowHandoff.kind} with your agent`}
          mcpCall={rowHandoff.kind === 'question'
            ? 'resource: evimesh://questions/open'
            : 'resource: read the claim revision via the web permalink above'}
          objectId={rowHandoff.id}
          objectType={rowHandoff.kind}
          onOpenChange={(open) => { if (!open) setRowHandoff(null); }}
          open={Boolean(rowHandoff)}
          scopes={['read', 'drafts']}
          view="explore"
        />
      ) : null}
    </PageContainer>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<PageContainer><Skeleton className="h-32 w-full" /><Skeleton className="mt-6 h-64 w-full" /></PageContainer>}>
      <ExploreView />
    </Suspense>
  );
}
