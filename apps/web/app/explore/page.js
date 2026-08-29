'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
import { Card, StatusBadge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { Attribution, actorHref } from '@/components/attribution';
import { HandoffSheet } from '@/components/handoff-sheet';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Rail, RailSection } from '@/components/ui/rail';
import { TabNav } from '@/components/ui/tab-nav';
import { cn } from '@/lib/utils';

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'question', label: 'Questions' },
  { id: 'project', label: 'Projects' },
  { id: 'claim', label: 'Claims' },
  { id: 'topic', label: 'Topics' },
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
      /* Mockup result cards carry a muted summary line under the title. */
      const revision = detail.currentRevision ?? {};
      const summary = revision.statement ?? revision.description ?? null;
      return {
        title: revision.title ?? null,
        summary: summary ? `${String(summary).slice(0, 120)}${summary.length > 120 ? '…' : ''}` : null,
      };
    }
    if (item.kind === 'claim') {
      const detail = await fetchJson(`/claims/${item.id}`);
      const statement = detail.currentRevision?.statement ?? null;
      return {
        title: statement ? `${statement.slice(0, 90)}${statement.length > 90 ? '…' : ''}` : null,
        summary: null,
      };
    }
    if (item.kind === 'project') {
      const detail = await fetchJson(`/projects/${item.id}`).then((body) => body.project ?? body);
      const revision = detail.currentRevision ?? detail;
      return {
        title: detail.name ?? revision.name ?? null,
        summary: (detail.summary ?? revision.summary) ? `${String(detail.summary ?? revision.summary).slice(0, 120)}${detail.summary.length > 120 ? '…' : ''}` : null,
      };
    }
    return { title: null, summary: null };
  } catch {
    return { title: null, summary: null };
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
  const [joinable, setJoinable] = useState(false);
  const [openTaskQuestions, setOpenTaskQuestions] = useState(null);
  const [actorDirectory, setActorDirectory] = useState(null);
  const [topicFilter, setTopicFilter] = useState(null);
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
        ...questions.map((question) => ({ kind: 'question', id: question.questionId, state: question.state, when: question.createdAt, projectId: question.projectId, topics: Array.isArray(question.topics) ? question.topics : [] })),
        ...projects.map((project) => ({ kind: 'project', id: project.projectId, state: project.state ?? 'active', when: project.createdAt })),
        ...claims.map((claim) => ({ kind: 'claim', id: claim.claimId, state: claim.state, when: claim.createdAt, questionId: claim.questionId, createdBy: claim.createdBy })),
      ];
      setItems(base);
      const heads = await Promise.all(base.slice(0, HYDRATE_LIMIT).map(async (item) => ({ ...item, ...(await hydrateTitle(item)) })));
      setItems([...heads, ...base.slice(HYDRATE_LIMIT)]);
      /* 可参与 filter dimension (mockup): questions with at least one open
       * task, derived from one bounded task-list read. */
      try {
        const openTasks = await fetchList('/tasks?status=open&limit=100');
        setOpenTaskQuestions(new Set(openTasks.map((task) => task.questionId).filter(Boolean)));
      } catch {
        setOpenTaskQuestions(new Set());
      }
      /* Researcher directory (mockup 研究者): the /actors endpoint is the
       * source; older deployments fall back to the derived view. */
      try {
        const body = await fetchJson('/actors?limit=100');
        const directory = body.items ?? [];
        setActorDirectory(directory);
        /* Attribution metadata (type + owning human) for createdBy rows. */
        const byId = new Map(directory.map((actor) => [actor.actorId, actor]));
        setItems((current) => current.map((item) => {
          const actor = item.createdBy ? byId.get(item.createdBy) : null;
          return actor ? { ...item, createdByActorType: actor.actorType ?? null, createdByOwnerActorId: actor.ownerActorId ?? null } : item;
        }));
      } catch {
        setActorDirectory(null);
      }
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

  /* Researcher rows (mockup 研究者): the /actors directory when the
   * deployment exposes it, enriched with derived object counts from the
   * loaded results. Falls back to the pure derived view on older APIs.
   * Recency order, never contribution counts: counts stay navigation aids. */
  const researchers = useMemo(() => {
    const derived = new Map();
    for (const item of windowed) {
      const actor = item.createdBy;
      if (!actor) continue;
      const entry = derived.get(actor) ?? { actorId: actor, count: 0, lastWhen: null };
      entry.count += 1;
      if (!entry.lastWhen || Date.parse(item.when ?? 0) > Date.parse(entry.lastWhen)) entry.lastWhen = item.when;
      derived.set(actor, entry);
    }
    if (actorDirectory) {
      return actorDirectory
        .map((actor) => ({ ...actor, count: derived.get(actor.actorId)?.count ?? 0, lastWhen: derived.get(actor.actorId)?.lastWhen ?? actor.createdAt }))
        .sort((left, right) => Date.parse(right.lastWhen ?? 0) - Date.parse(left.lastWhen ?? 0));
    }
    return [...derived.values()].sort((left, right) => Date.parse(right.lastWhen ?? 0) - Date.parse(left.lastWhen ?? 0));
  }, [windowed, actorDirectory]);

  /* Topic rows (mockup 主题): aggregated from the questions' own topic tags.
   * Alphabetical, never by count — counts are entry points only. */
  const topics = useMemo(() => {
    const counts = new Map();
    for (const item of windowed) {
      if (item.kind !== 'question') continue;
      for (const topic of item.topics ?? []) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => left.label.localeCompare(right.label));
  }, [windowed]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (type === 'researcher') {
      return researchers.filter((entry) => !needle || entry.actorId.toLowerCase().includes(needle)).slice(0, 40);
    }
    if (type === 'topic') {
      return topics.filter((topic) => !needle || topic.label.toLowerCase().includes(needle));
    }
    return windowed
      .filter((item) => (type === 'all' || item.kind === type))
      .filter((item) => !topicFilter || (item.kind === 'question' && (item.topics ?? []).includes(topicFilter)))
      .filter((item) => !joinable || (item.kind === 'question' && openTaskQuestions?.has(item.id)))
      .filter((item) => !needle || item.id.toLowerCase().includes(needle) || (item.projectId ?? '').toLowerCase().includes(needle))
      .sort((left, right) => {
        if (sort === 'title') return String(left.title ?? left.id).localeCompare(String(right.title ?? right.id));
        return Date.parse(right.when ?? 0) - Date.parse(left.when ?? 0);
      })
      .slice(0, 40);
  }, [windowed, researchers, topics, query, type, sort, joinable, openTaskQuestions, topicFilter]);

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
          {topicFilter ? (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary bg-accent px-3 text-sm font-medium text-accent-foreground"
              onClick={() => setTopicFilter(null)}
              type="button"
            >
              topic: {topicFilter}
              <span aria-hidden="true">✕</span>
            </button>
          ) : null}
          <TabNav
            active={type}
            ariaLabel="Result type"
            items={TYPES.map((entry) => ({
              count: entry.id === 'all' ? windowed.length : entry.id === 'researcher' ? researchers.length : entry.id === 'topic' ? topics.length : windowed.filter((item) => item.kind === entry.id).length,
              key: entry.id,
              label: entry.label,
            }))}
            onChange={setType}
          />
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
          <button
            aria-pressed={joinable}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors',
              joinable ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setJoinable((value) => !value)}
            type="button"
          >
            Open to participate
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:[grid-template-columns:minmax(0,1fr)_18rem] lg:items-start">
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
          ) : type === 'topic' ? (
            <Card className="divide-y divide-border">
              {results.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">No topic tags yet.</p>
              ) : results.map((topic) => (
                <article className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted/50" key={topic.label}>
                  <span aria-hidden="true" className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">topic</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{topic.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{topic.count} question{topic.count === 1 ? '' : 's'}</span>
                  <button
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => { setTopicFilter(topic.label); setType('question'); }}
                    type="button"
                  >
                    Filter questions
                  </button>
                </article>
              ))}
              <p className="px-5 py-3 text-xs text-muted-foreground">Topic tags are plain navigation labels recorded on questions — never a taxonomy, and counts are entry points, not rankings.</p>
            </Card>
          ) : type === 'researcher' ? (
            <Card className="divide-y divide-border">
              {results.map((entry) => (
                <article className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted/50" key={entry.actorId}>
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {(entry.displayName ?? entry.actorId).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <Link className="block truncate font-medium hover:underline" href={actorHref(entry.actorId, entry.actorType)}>{entry.displayName ?? entry.actorId}</Link>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{entry.actorId}</span>
                    {entry.actorType === 'agent' && entry.ownerActorId ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        owned by <Link className="hover:text-foreground" href={`/people/${encodeURIComponent(entry.ownerActorId)}`}>{entry.ownerActorId}</Link>
                      </span>
                    ) : null}
                  </span>
                  {entry.actorType ? <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{entry.actorType}</span> : null}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{entry.count} linked object{entry.count === 1 ? '' : 's'}</span>
                  <Link className="text-xs font-medium text-primary hover:underline" href={actorHref(entry.actorId, entry.actorType)}>open</Link>
                </article>
              ))}
              <p className="px-5 py-3 text-xs text-muted-foreground">{actorDirectory ? 'From the actor directory, with object counts derived from the loaded results. Counts are entry points, never contribution scores.' : 'Derived from attribution on the currently loaded questions and claims (the actor directory endpoint is unavailable on this deployment). Object counts are entry points, never contribution scores.'}</p>
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
                  {item.summary ? <p className="max-w-[70ch] truncate text-sm text-muted-foreground">{item.summary}</p> : null}
                  {joinable && item.kind === 'question' && openTaskQuestions?.has(item.id) ? <p className="text-xs text-muted-foreground">open tasks available to pick up</p> : null}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <IdChip value={item.id} />
                    {item.createdBy ? <Attribution actorId={item.createdBy} actorType={item.createdByActorType} ownerActorId={item.createdByOwnerActorId} /> : null}
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
              {results.length} of {windowed.length} loaded object{windowed.length === 1 ? '' : 's'} shown. Ordered by recent activity. Sorting never expresses research value or support. Stable ids live in each result row.
            </p>
          ) : null}
        </div>

        <Rail label="Scope">
          <RailSection title="Topics">
          {topics.length === 0 ? (
            <p className="text-xs text-muted-foreground">No topic tags yet.</p>
          ) : (
            <ul className="grid gap-1.5">
              {topics.slice(0, 8).map((topic) => (
                <li key={topic.label}>
                  <button
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded px-1.5 py-1 text-xs hover:bg-muted',
                      topicFilter === topic.label && 'bg-accent text-accent-foreground',
                    )}
                    onClick={() => setTopicFilter(topicFilter === topic.label ? null : topic.label)}
                    type="button"
                  >
                    <span className="min-w-0 truncate">{topic.label}</span>
                    <span className="tabular-nums text-muted-foreground">{topic.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-muted-foreground">Alphabetical; counts are entry points, never rankings.</p>
          </RailSection>
          <RailSection title="Order by">
          <div className="grid gap-2 text-sm">
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
          </RailSection>
          <RailSection title="Active filters">
            <p className="text-xs text-muted-foreground">
              {topicFilter ? <>topic: {topicFilter}. </> : null}
              {last30 ? <>Last 30 days. </> : null}
              {joinable ? <>Open to participate. </> : null}
              {!topicFilter && !last30 && !joinable ? 'None beyond the type tab.' : null}
              {' '}All counts include questions, projects, and claims; researchers and topics are separate tabs.
            </p>
          </RailSection>
        </Rail>
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
