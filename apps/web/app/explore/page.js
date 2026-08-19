'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
];

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
      setItems([
        ...questions.map((question) => ({ kind: 'question', id: question.questionId, state: question.state, when: question.createdAt, projectId: question.projectId })),
        ...projects.map((project) => ({ kind: 'project', id: project.projectId, state: project.state ?? 'active', when: project.createdAt })),
        ...claims.map((claim) => ({ kind: 'claim', id: claim.claimId, state: claim.state, when: claim.createdAt, questionId: claim.questionId })),
      ]);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => (type === 'all' || item.kind === type))
      .filter((item) => !needle || item.id.toLowerCase().includes(needle) || (item.projectId ?? '').toLowerCase().includes(needle))
      .sort((left, right) => {
        if (sort === 'title') return String(left.id).localeCompare(String(right.id));
        if (sort === 'created') return Date.parse(right.when ?? 0) - Date.parse(left.when ?? 0);
        return Date.parse(right.when ?? 0) - Date.parse(left.when ?? 0);
      })
      .slice(0, 40);
  }, [items, query, type, sort]);

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
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Result type">
          {TYPES.map((entry) => (
            <button
              aria-selected={type === entry.id}
              className={cn(
                'h-8 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors',
                type === entry.id ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
              key={entry.id}
              onClick={() => setType(entry.id)}
              role="tab"
              type="button"
            >
              {entry.label}
            </button>
          ))}
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
          ) : (
            <Card className="divide-y divide-border">
              {results.map((item) => (
                <article className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted/50" key={`${item.kind}-${item.id}`}>
                  <StatusBadge label={item.kind} state={item.state} />
                  <IdChip className="min-w-0 flex-1" value={item.id} />
                  <Link className="text-xs font-medium text-primary hover:underline" href={hrefFor(item)}>open</Link>
                  <button className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setRowHandoff(item)} type="button">Hand to agent</button>
                  {item.projectId ? <span className="text-xs tabular-nums text-muted-foreground">project {item.projectId}</span> : null}
                  <span className="ml-auto text-xs capitalize text-muted-foreground">{item.kind}</span>
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
              ['created', 'Newest created'],
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
          cliCommand={`sq ${rowHandoff.kind === 'question' ? 'question list' : 'project list'}   # locate ${rowHandoff.id}`}
          intent={`Continue this ${rowHandoff.kind} with your agent`}
          mcpCall={`resource: evimesh://${rowHandoff.kind}s`}
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
