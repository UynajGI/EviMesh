'use client';

import Link from 'next/link';
import { actorHref } from '@/components/attribution';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card, StatusBadge } from '@/components/ui/data';
import { Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { hydrateEvidenceLinks, evidenceRelations } from '@/lib/hydrate';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `${path} is unavailable.`);
  return payload;
}

/*
 * Real public example (design book 05 §1): show an actual live question with
 * its claim states instead of inventing a demo. Falls back to the honest
 * descriptive card when the API is empty or unreachable.
 */
function toRelativeTime(value) {
  return <span title={value ?? undefined}>{relativeTime(value)}</span>;
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export function LandingExample({ fallback }) {
  const [example, setExample] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        const questions = await fetchJson('/questions?limit=8').then((body) => body.items ?? []);
        const open = questions.filter((question) => !['resolved', 'archived', 'rejected'].includes(question.state));
        for (const question of open.slice(0, 4)) {
          const claims = await fetchJson(`/claims?projectId=${question.projectId}&limit=100`)
            .then((body) => (body.items ?? []).filter((claim) => claim.questionId === question.questionId))
            .catch(() => []);
          if (claims.length > 0) {
            const frontier = await fetchJson(`/projects/${question.projectId}/frontier/latest`)
              .then((body) => body.frontier ?? null).catch(() => null);
            // Evidence grouped counts per claim (mockup claim rows): hydrate
            // relations from the detail endpoint, bounded to the shown rows.
            const enriched = await Promise.all(claims.slice(0, 3).map(async (claim) => {
              const evidence = await fetchJson(`/evidence?claimId=${claim.claimId}&limit=20`).then((body) => body.items ?? []).catch(() => []);
              const hydrated = await hydrateEvidenceLinks(API, evidence);
              const counts = {};
              for (const relation of ['supports', 'refutes', 'qualifies', 'reproduces']) {
                counts[relation] = hydrated.filter((item) => evidenceRelations(item).includes(relation)).length;
              }
              return { ...claim, evidenceCounts: counts };
            }));
            const contributor = await fetchJson(`/events?objectType=question&objectId=${question.questionId}&limit=1`)
              .then((body) => body.items?.[0]?.actorId ?? null).catch(() => null);
            setExample({ question, claims: enriched, frontier, contributor });
            return;
          }
        }
        setExample(null);
      } catch {
        setExample(null);
      }
    })();
  }, []);

  if (example === 'loading') {
    return <Card><div className="p-5"><Skeleton className="h-6 w-2/3" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-2 h-4 w-4/5" /></div></Card>;
  }
  if (!example) return fallback;

  const { question, claims, frontier, contributor } = example;
  const revision = question.currentRevision ?? question;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge state={question.state} label="question" />
          {frontier ? <span className="text-xs tabular-nums text-muted-foreground">Frontier #{frontier.sequence}</span> : null}
          <span className="text-xs tabular-nums text-muted-foreground">project {question.projectId}</span>
          {revision.createdAt ? <span className="text-xs tabular-nums text-muted-foreground">{toRelativeTime(revision.createdAt)}</span> : null}
        </div>
        <IdChip value={question.questionId} />
      </div>
      <div className="px-5 py-4">
        <h3 className="text-lg font-medium leading-snug">{revision.title ?? revision.statement ?? question.questionId}</h3>
        {revision.statement && revision.title ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{revision.statement}</p> : null}
        <ul className="mt-4 divide-y divide-border">
          {claims.map((claim) => (
            <li className="grid gap-1.5 py-2.5" key={claim.claimId}>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge state={claim.state} />
                <Link className="min-w-0 flex-1 truncate text-sm text-muted-foreground hover:text-foreground" href={`/claims/${claim.claimId}`}>
                  Open evidence, verification, and downstream context
                </Link>
                <IdChip value={claim.claimId} />
              </div>
              {claim.evidenceCounts && Object.values(claim.evidenceCounts).some((count) => count > 0) ? (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                  {claim.evidenceCounts.supports > 0 ? <Link className="hover:text-foreground" href={`/claims/${claim.claimId}`}>supports {claim.evidenceCounts.supports}</Link> : null}
                  {claim.evidenceCounts.refutes > 0 ? <Link className="hover:text-foreground" href={`/claims/${claim.claimId}`}>refutes {claim.evidenceCounts.refutes}</Link> : null}
                  {claim.evidenceCounts.qualifies > 0 ? <Link className="hover:text-foreground" href={`/claims/${claim.claimId}`}>qualifies {claim.evidenceCounts.qualifies}</Link> : null}
                  {claim.evidenceCounts.reproduces > 0 ? <Link className="hover:text-foreground" href={`/claims/${claim.claimId}`}>reproduces {claim.evidenceCounts.reproduces}</Link> : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Every count opens onto the exact revision, receipt, or event behind it.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          Live public research
          {contributor ? (
            <span>
              {' '}· contributed by{' '}
              <Link className="font-medium text-foreground hover:underline" href={actorHref(contributor)}>{contributor}</Link>
            </span>
          ) : null}
        </span>
        <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={`/questions/${question.questionId}`}>
          Enter the workspace <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </Card>
  );
}
