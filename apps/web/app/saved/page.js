'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { DeniedState, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { EngagementActions } from '@/components/engagement-actions';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { fetchMyInteractions, useMyInteractions } from '@/lib/interactions';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

/* Personal saves only (owner direction 2026-08-21): this list is the
 * viewer's own navigation record. It carries no counts and no ordering
 * statement beyond recency of the save itself. */
export default function SavedPage() {
  const [rows, setRows] = useState(null);
  const [titles, setTitles] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const { has, toggle } = useMyInteractions();

  async function load() {
    setError(null);
    setRequestId(null);
    try {
      const saved = await fetchMyInteractions(['favorite']);
      setRows(saved);
      const bound = saved.slice(0, 20);
      const entries = await Promise.all(bound.map(async (row) => {
        if (row.objectType === 'question') {
          try {
            const response = await fetch(`${API}/questions/${row.objectId}`);
            const detail = await response.json();
            return [`${row.objectType}:${row.objectId}`, detail.currentRevision?.title ?? null];
          } catch { return null; }
        }
        if (row.objectType === 'claim') {
          try {
            const response = await fetch(`${API}/claims/${row.objectId}`);
            const detail = await response.json();
            const statement = detail.currentRevision?.statement;
            return [`${row.objectType}:${row.objectId}`, statement ? `${statement.slice(0, 110)}${statement.length > 110 ? '…' : ''}` : null];
          } catch { return null; }
        }
        return null;
      }));
      setTitles(new Map(entries.filter(Boolean)));
    } catch (reason) {
      if (reason.status === 401 || reason.code === 'INTERACTION_AUTH_REQUIRED') setNeedsAuth(true);
      else {
        setError(reason.message);
        setRequestId(reason.requestId ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { document.title = 'Saved · EviMesh'; }, []);

  const hrefFor = (row) => (row.objectType === 'question' ? `/questions/${row.objectId}` : row.objectType === 'claim' ? `/claims/${row.objectId}` : row.objectType === 'task' ? `/tasks/${row.objectId}` : `/projects/${row.objectId}`);

  return (
    <PageContainer>
      <PageHeader
        description="Your personal bookmarks. Private to you — never shown as public counts."
        eyebrow="Personal"
        title="Saved for later"
      />
      {error ? <ErrorState className="mt-10" message={error} requestId={requestId ?? undefined} onRetry={load} /> : null}
      {needsAuth ? (
        <DeniedState
          className="mt-10"
          description="Your saves live in a signed-in scope. Sign in to see them here."
          scope="signed-in saves"
          title="Signed-out scope"
          action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/login">Sign in</Link>}
          actionLabel="Sign in"
        />
      ) : loading ? (
        <div className="mt-2 grid gap-3">{[0, 1, 2, 3].map((key) => <Skeleton className="h-16 w-full" key={key} />)}</div>
      ) : !rows?.length ? (
        <Empty
          action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/home">Browse the feed</Link>}
          description="Save questions and claims with the bookmark action to keep them here."
          title="Nothing saved yet"
        />
      ) : (
        <ul className="mt-2 grid gap-3">
          {rows.map((row) => (
            <li className="flex items-start gap-3 rounded-lg border border-border bg-card p-4" key={`${row.objectType}-${row.objectId}`}>
              <Bookmark aria-hidden="true" className="mt-0.5 shrink-0 text-primary" fill="currentColor" size={16} />
              <div className="min-w-0 flex-1">
                <Link className="block truncate font-medium hover:underline" href={hrefFor(row)}>
                  {titles.get(`${row.objectType}:${row.objectId}`) ?? row.objectId}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.objectType} · saved {new Date(row.createdAt).toLocaleDateString()}</p>
              </div>
              <EngagementActions has={has} objectId={row.objectId} objectType={row.objectType} onToggle={toggle} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
