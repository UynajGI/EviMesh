'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Clock, Compass, ListTodo, Sparkles } from 'lucide-react';
import { DeniedState, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/ui/data';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { EngagementActions } from '@/components/engagement-actions';
import { fetchRecommendations, useMyInteractions } from '@/lib/interactions';
import { readVisitHistory } from '@/lib/visit-history';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

const CLOSED_STATES = new Set(['resolved', 'archived', 'rejected']);
const ATTENTION_STATES = new Set(['refuted', 'retracted', 'contested', 'dependency_tainted']);

const PAGE = 30;
/* Card titles live on detail endpoints; hydrate the first cards' heads and
 * let the rest fall back to the stable id line. */
const HYDRATE = 12;

function toRelativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Activity time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function getJson(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) {
    const failure = new Error(payload.message ?? `${path} is unavailable.`);
    failure.requestId = payload.request_id ?? payload.requestId ?? null;
    throw failure;
  }
  return payload;
}

/*
 * Discovery feed (owner direction 2026-08-21: the home page is a
 * recommendation-style browsing surface in the shape of RED / Bilibili /
 * Toutiao — a masonry card stream with topic chips, load-more, and a
 * personal rail). The protocol boundary holds underneath the new shape:
 * the only ordering is time (newest first), counts stay navigation entry
 * points, and there are no popularity, engagement, or relevance scores.
 */
export default function HomePage() {
  const [questions, setQuestions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [frontiers, setFrontiers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [cursors, setCursors] = useState({ questions: null, claims: null });
  const [topicFilter, setTopicFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [visits, setVisits] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const { has, toggle } = useMyInteractions();

  /* Personal rail: loads after the feed and only exists for signed-in
   * viewers with trained signal. It never reorders the feed itself. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await fetchRecommendations(12);
        if (cancelled || !Array.isArray(payload.items) || payload.items.length === 0) return;
        const heads = await Promise.all(payload.items.map(async (item) => {
          if (item.objectType === 'question') {
            try { const detail = await getJson(`/questions/${item.objectId}`); return detail.currentRevision?.title ?? null; } catch { return null; }
          }
          if (item.objectType === 'claim') {
            try { const detail = await getJson(`/claims/${item.objectId}`); const statement = detail.currentRevision?.statement; return statement ? `${statement.slice(0, 90)}${statement.length > 90 ? '…' : ''}` : null; } catch { return null; }
          }
          return null;
        }));
        if (!cancelled) setRecommendations(payload.items.map((item, position) => ({ ...item, title: heads[position] })));
      } catch { /* signed out or not trained yet: the rail simply stays away */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setVisits(readVisitHistory());
    const onFocus = () => setVisits(readVisitHistory());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const [questionPage, claimPage, projectItems, taskGroups] = await Promise.all([
        getJson(`/questions?limit=${PAGE}`),
        getJson(`/claims?limit=${PAGE}`),
        getJson('/projects?limit=6').then((payload) => payload.items ?? []),
        Promise.all(['cpu-only', 'under-60-min'].map((tag) => getJson(`/tasks?status=open&tag=${tag}&limit=6`).then((payload) => (payload.items ?? []).map((task) => ({ ...task, tag }))))),
      ]);
      const frontierRows = await Promise.all(projectItems.map(async (project) => {
        try {
          const payload = await getJson(`/projects/${project.projectId}/frontier/latest`);
          return payload.frontier ? { project, frontier: payload.frontier } : null;
        } catch { return null; }
      }));

      /* Card heads hydrate from detail endpoints (bounded), then the lists
       * land once with heads attached. */
      const heads = await Promise.all([
        ...((questionPage.items ?? []).slice(0, HYDRATE).map(async (question) => {
          try {
            const detail = await getJson(`/questions/${question.questionId}`);
            return { kind: 'question', id: question.questionId, title: detail.currentRevision?.title ?? null, summary: detail.currentRevision?.statement ?? null };
          } catch { return null; }
        })),
        ...((claimPage.items ?? []).slice(0, HYDRATE).map(async (claim) => {
          try {
            const detail = await getJson(`/claims/${claim.claimId}`);
            const statement = detail.currentRevision?.statement ?? null;
            return { kind: 'claim', id: claim.claimId, title: statement ? `${statement.slice(0, 110)}${statement.length > 110 ? '…' : ''}` : null };
          } catch { return null; }
        })),
      ]);
      const headFor = (kind, id) => heads.find((head) => head && head.kind === kind && head.id === id) ?? {};

      setQuestions((questionPage.items ?? []).map((question) => ({ ...question, cardTitle: headFor('question', question.questionId).title, cardSummary: headFor('question', question.questionId).summary })));
      setClaims((claimPage.items ?? []).map((claim) => ({ ...claim, cardTitle: headFor('claim', claim.claimId).title })));
      setFrontiers(frontierRows.filter(Boolean));
      setTasks(taskGroups.flat().slice(0, 6));
      setCursors({ questions: questionPage.nextCursor ?? null, claims: claimPage.nextCursor ?? null });
    } catch (reason) {
      setError(reason.message);
      setRequestId(reason.requestId ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore || (!cursors.questions && !cursors.claims)) return;
    setLoadingMore(true);
    try {
      const [nextQuestions, nextClaims] = await Promise.all([
        cursors.questions
          ? getJson(`/questions?limit=${PAGE}&cursor=${encodeURIComponent(cursors.questions)}`).catch(() => null)
          : Promise.resolve(null),
        cursors.claims
          ? getJson(`/claims?limit=${PAGE}&cursor=${encodeURIComponent(cursors.claims)}`).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (nextQuestions?.items?.length) setQuestions((current) => [...current, ...nextQuestions.items]);
      if (nextClaims?.items?.length) setClaims((current) => [...current, ...nextClaims.items]);
      setCursors({
        questions: nextQuestions?.nextCursor ?? (nextQuestions ? null : cursors.questions),
        claims: nextClaims?.nextCursor ?? (nextClaims ? null : cursors.claims),
      });
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { document.title = 'Home · EviMesh'; }, []);

  /* Topic chips from the loaded questions' own tags (alphabetical; a chip
   * narrows the feed to the questions carrying that topic). */
  const topics = useMemo(() => {
    const counts = new Map();
    for (const question of questions) {
      for (const topic of Array.isArray(question.topics) ? question.topics : []) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => left.label.localeCompare(right.label));
  }, [questions]);

  /* The feed is strictly newest-first; levels never rank it. */
  const feed = useMemo(() => {
    const cards = [
      ...questions.filter((question) => !CLOSED_STATES.has(question.state)).map((question) => ({
        kind: 'question', id: question.questionId, state: question.state, when: question.createdAt,
        title: question.cardTitle, summary: question.cardSummary, topics: Array.isArray(question.topics) ? question.topics : [], projectId: question.projectId,
      })),
      ...claims.map((claim) => ({ kind: 'claim', id: claim.claimId, state: claim.state, when: claim.createdAt, title: claim.cardTitle, questionId: claim.questionId })),
      ...frontiers.map(({ project, frontier }) => ({ kind: 'frontier', id: frontier.snapshotId, state: 'update', when: frontier.createdAt, sequence: frontier.sequence, project })),
    ];
    return cards
      .filter((card) => !topicFilter || (card.kind === 'question' && card.topics.includes(topicFilter)))
      .sort((left, right) => Date.parse(right.when ?? 0) - Date.parse(left.when ?? 0));
  }, [questions, claims, frontiers, topicFilter]);

  const attentionClaims = claims.filter((claim) => ATTENTION_STATES.has(claim.state)).slice(0, 4);

  const hrefFor = (card) => (card.kind === 'question' ? `/questions/${card.id}` : card.kind === 'claim' ? `/claims/${card.id}` : `/projects/${card.project.projectId}`);
  const hasMore = Boolean(cursors.questions || cursors.claims);

  return (
    <PageContainer wide>
      <PageHeader
        action={(
          <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted" href="/explore">
            <Compass aria-hidden="true" size={14} />
            Explore everything
          </Link>
        )}
        description="Newest first. Ordering never expresses research value."
        eyebrow="Home"
        title="Research as it happens"
      />
      {error ? <ErrorState className="mt-10" message={error} requestId={requestId ?? undefined} onRetry={load} /> : null}

      <div className="mt-2 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0">
          {attentionClaims.length > 0 ? (
            <section aria-label="Needs attention" className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-status-danger-fg">Needs attention</h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {attentionClaims.map((claim) => (
                  <Link className="min-w-64 shrink-0 rounded-lg border border-status-danger-border bg-status-danger-bg px-4 py-3 hover:border-primary" href={`/claims/${claim.claimId}`} key={claim.claimId}>
                    <StatusBadge state={claim.state} />
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium">{claim.cardTitle ?? claim.claimId}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {recommendations?.length ? (
            <section aria-label="For you" className="mb-6">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide"><Sparkles aria-hidden="true" size={14} /> For you</h2>
                <p className="text-[11px] text-muted-foreground">From your activity · navigation, not a rating</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recommendations.map((item) => (
                  <Link
                    className="min-w-64 shrink-0 rounded-lg border border-primary bg-card px-4 py-3 transition-colors hover:bg-muted"
                    href={item.objectType === 'question' ? `/questions/${item.objectId}` : item.objectType === 'claim' ? `/claims/${item.objectId}` : `/tasks/${item.objectId}`}
                    key={`${item.objectType}-${item.objectId}`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide text-primary">{item.objectType}</span>
                    <p className="mt-1 line-clamp-2 text-sm font-medium">{item.title ?? item.objectId}</p>
                    {item.reason ? <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{item.reason}</p> : null}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {topics.length > 0 ? (
            <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Topics">
              <button
                className={cn('rounded-full border px-3 py-1 text-xs font-medium', topicFilter === null ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground')}
                onClick={() => setTopicFilter(null)}
                type="button"
              >
                All
              </button>
              {topics.slice(0, 10).map((topic) => (
                <button
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium', topicFilter === topic.label ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground')}
                  key={topic.label}
                  onClick={() => setTopicFilter(topicFilter === topic.label ? null : topic.label)}
                  type="button"
                >
                  {topic.label}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
              {[0, 1, 2, 3, 4, 5].map((key) => <Skeleton className="mb-4 h-40 w-full break-inside-avoid" key={key} />)}
            </div>
          ) : feed.length === 0 ? (
            <Empty
              action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/explore">Find research to follow</Link>}
              description={topicFilter ? `No questions tagged “${topicFilter}” yet.` : 'Questions, claims, and frontier snapshots will flow here as the network grows.'}
              title={topicFilter ? 'Nothing under this topic' : 'The feed is empty'}
            />
          ) : (
            <>
              <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
                {feed.map((card) => (
                  <article className="mb-4 break-inside-avoid rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary" key={`${card.kind}-${card.id}`}>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={card.kind} state={card.state} />
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">{toRelativeTime(card.when)}</span>
                    </div>
                    {card.kind === 'claim' ? (
                      <Link className="claim-statement mt-2.5 block font-serif text-base leading-relaxed hover:underline" href={hrefFor(card)}>{card.title ?? card.id}</Link>
                    ) : card.kind === 'question' ? (
                      <>
                        <Link className="mt-2.5 block text-base font-semibold leading-snug hover:underline" href={hrefFor(card)}>{card.title ?? card.id}</Link>
                        {card.summary ? <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted-foreground">{card.summary.length > 150 ? `${card.summary.slice(0, 150)}…` : card.summary}</p> : null}
                        {card.topics.length > 0 ? (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {card.topics.slice(0, 3).map((topic) => (
                              <button className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground" key={topic} onClick={() => setTopicFilter(topic)} type="button">{topic}</button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <Link className="mt-2.5 block text-base font-semibold leading-snug hover:underline" href={hrefFor(card)}>
                        Frontier #{card.sequence}
                        <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{card.project.projectId}</span>
                      </Link>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
                      <IdChip label={card.kind === 'frontier' ? 'snapshot' : card.kind} value={card.id} />
                      {card.kind !== 'frontier' ? <EngagementActions compact has={has} objectId={card.id} objectType={card.kind} onToggle={toggle} /> : null}
                      <Link className="ml-auto text-xs font-medium text-primary hover:underline" href={hrefFor(card)}>open</Link>
                    </div>
                  </article>
                ))}
              </div>
              {hasMore ? (
                <button
                  className="mx-auto mt-2 block rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
                  disabled={loadingMore}
                  onClick={loadMore}
                  type="button"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
            </>
          )}
        </div>

        <aside aria-label="Context" className="grid gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <ListTodo aria-hidden="true" className="text-muted-foreground" size={16} />
              <h2 className="text-sm font-semibold">My work</h2>
            </div>
            <ul className="mt-3 grid gap-2">
              {[
                { label: 'Claims awaiting your verification', count: claims.length, href: '/work' },
                { label: 'Open tasks to pick up', count: tasks.length, href: '/work' },
                { label: 'Frontiers published', count: frontiers.length, href: '/explore' },
              ].map((row) => (
                <li className="flex items-center justify-between gap-2 text-xs" key={row.label}>
                  <Link className="text-muted-foreground hover:text-foreground" href={row.href}>{row.label}</Link>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium tabular-nums text-muted-foreground">{row.count}</span>
                </li>
              ))}
            </ul>
            <Link className="mt-3 inline-block text-xs font-medium text-primary hover:underline" href="/work">Go to Work →</Link>
            <Link className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline" href="/saved">Saved for later →</Link>
          </div>

          {/* States matrix (08 §1): the signed-out surface names its scope
              boundary instead of silently showing a narrower feed. */}
          <DeniedState
            className="p-4"
            description="Your watchlist, drafts, and pending signatures need a signed-in scope."
            scope="signed-in watchlist"
            title="Signed-out scope"
            action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/login">Sign in</Link>}
            actionLabel="Sign in"
          />

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Bot aria-hidden="true" className="text-muted-foreground" size={16} />
              <h2 className="text-sm font-semibold">Agent connection</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Six steps from hearing about EviMesh to a first trusted read.</p>
            <Link className="mt-3 inline-block text-xs font-medium text-primary hover:underline" href="/agent">Open the center →</Link>
          </div>

          {visits.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4" aria-label="Recently visited">
              <div className="flex items-center gap-2">
                <Clock aria-hidden="true" className="text-muted-foreground" size={16} />
                <h2 className="text-sm font-semibold">Recently visited</h2>
              </div>
              <ul className="mt-3 grid gap-1">
                {visits.map((visit) => (
                  <li key={visit.href}>
                    <Link className="flex min-w-0 items-baseline gap-2 rounded px-1 py-1 text-xs hover:bg-muted" href={visit.href}>
                      <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{visit.kind}</span>
                      <span className="min-w-0 truncate">{visit.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Activity aria-hidden="true" className="text-muted-foreground" size={16} />
              <h2 className="text-sm font-semibold">Event audit</h2>
            </div>
            <Link className="mt-2 inline-block text-xs font-medium text-primary hover:underline" href="/events">Open audit →</Link>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
