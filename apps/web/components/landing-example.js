'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card, StatusBadge } from '@/components/ui/data';
import { Skeleton } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';

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
export function LandingExample({ fallback }) {
  const [example, setExample] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        const questions = await fetchJson('/questions?limit=8').then((body) => body.items ?? []);
        const open = questions.filter((question) => !['resolved', 'archived', 'rejected'].includes(question.state));
        for (const question of open.slice(0, 4)) {
          const claims = await fetchJson(`/claims?projectId=${question.question.projectId}&limit=100`)
            .then((body) => (body.items ?? []).filter((claim) => claim.questionId === question.questionId))
            .catch(() => []);
          if (claims.length > 0) {
            const frontier = await fetchJson(`/projects/${question.question.projectId}/frontier/latest`)
              .then((body) => body.frontier ?? null).catch(() => null);
            setExample({ question, claims: claims.slice(0, 3), frontier });
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

  const { question, claims, frontier } = example;
  const revision = question.currentRevision ?? question;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge state={question.question.state} label="question" />
          {frontier ? <span className="text-xs tabular-nums text-muted-foreground">Frontier #{frontier.sequence}</span> : null}
        </div>
        <IdChip value={question.question.questionId} />
      </div>
      <div className="px-5 py-4">
        <h3 className="text-lg font-medium leading-snug">{revision.title ?? revision.statement ?? question.question.questionId}</h3>
        {revision.statement && revision.title ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{revision.statement}</p> : null}
        <ul className="mt-4 divide-y divide-border">
          {claims.map((claim) => (
            <li className="flex flex-wrap items-center gap-3 py-2.5" key={claim.claimId}>
              <StatusBadge state={claim.state} />
              <Link className="min-w-0 flex-1 truncate text-sm text-muted-foreground hover:text-foreground" href={`/claims/${claim.claimId}`}>
                Open evidence, verification, and downstream context
              </Link>
              <IdChip value={claim.claimId} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Counts are entry points, never scores. Every number opens onto the exact revision, receipt, or event behind it.
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <span className="text-xs text-muted-foreground">Live public research</span>
        <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={`/questions/${question.question.questionId}`}>
          Enter the workspace <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </Card>
  );
}
