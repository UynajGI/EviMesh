'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonLinkVariants } from '@/components/ui/button';
import { DeniedState, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { EngagementActions } from '@/components/engagement-actions';
import { shortId } from '@/components/ui/doc';
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
      <PageHeader title="Saved" />
      {error ? <ErrorState className="mt-8" message={error} requestId={requestId ?? undefined} onRetry={load} /> : null}
      {needsAuth ? (
        <DeniedState
          className="mt-8"
          description="Saves are private to your account."
          scope="signed-in saves"
          title="Sign in to see your saves"
          action={<Link className={buttonLinkVariants({ variant: 'default', size: 'sm' })} href="/login">Sign in</Link>}
          actionLabel="Sign in"
        />
      ) : loading ? (
        <div className="mt-6 grid gap-3">{[0, 1, 2, 3].map((key) => <Skeleton className="h-12 w-full" key={key} />)}</div>
      ) : !rows?.length ? (
        <Empty
          action={<Link className="text-primary hover:underline" href="/explore">Explore</Link>}
          className="mt-6"
          title="Nothing saved yet"
        />
      ) : (
        <ul className="mt-6">
          {rows.map((row) => (
            <li className="flex items-start gap-3 border-b border-border py-3" key={`${row.objectType}-${row.objectId}`}>
              <div className="min-w-0 flex-1">
                {titles.get(`${row.objectType}:${row.objectId}`) ? (
                  <Link className="block truncate font-serif hover:underline" href={hrefFor(row)}>{titles.get(`${row.objectType}:${row.objectId}`)}</Link>
                ) : (
                  <Link className="block truncate font-mono text-sm hover:underline" href={hrefFor(row)} title={row.objectId}>{shortId(row.objectId)}</Link>
                )}
                <p className="mt-1 text-xs text-muted-foreground first-letter:uppercase">{row.objectType} · saved {new Date(row.createdAt).toLocaleDateString()}</p>
              </div>
              <EngagementActions has={has} objectId={row.objectId} objectType={row.objectType} onToggle={toggle} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
