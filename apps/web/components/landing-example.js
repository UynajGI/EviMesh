'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/data';
import { ActorName, Identifier } from '@/components/ui/doc';
import { Skeleton } from '@/components/ui/feedback';
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
 * its claim states instead of inventing a demo, set as a small title-block
 * excerpt of the controlled document. Falls back to the honest, labeled demo
 * excerpt when the API is empty or unreachable.
 */
export function ExampleExcerpt({ kind, status, note, title, cells, children, footer }) {
  return (
    <section aria-label={`Example ${kind.toLowerCase()}`} className="border-t border-foreground pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
        <span className="font-medium">{kind}</span>
        {status}
        {note ? <span className="text-muted-foreground">{note}</span> : null}
      </div>
      <h2 className="claim-statement mt-2 max-w-[40ch] text-pretty font-serif text-[1.5rem] font-medium leading-[1.25] tracking-[-0.01em] [overflow-wrap:anywhere]">{title}</h2>
      {cells.length > 0 ? (
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          {cells.filter((cell) => cell.value).map((cell) => (
            <div className="inline-flex items-baseline gap-1.5" key={cell.label}>
              <dt className="text-muted-foreground">{cell.label}</dt>
              <dd>{cell.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children ? <div className="mt-4 border-t border-border">{children}</div> : null}
      {footer ? <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 text-[13px]">{footer}</div> : null}
    </section>
  );
}

export function ExampleClaimRow({ state, statement, href, children }) {
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-border py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <div><StatusBadge state={state} /></div>
      <div className="min-w-0">
        {href ? (
          <Link className="font-serif text-[1.0625rem] leading-snug hover:underline" href={href}>{statement}</Link>
        ) : (
          <p className="font-serif text-[1.0625rem] leading-snug">{statement}</p>
        )}
        {children}
      </div>
    </li>
  );
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
            // Evidence grouped counts per claim: hydrate relations from the
            // detail endpoint, bounded to the shown rows. Counts are links.
            const enriched = await Promise.all(claims.slice(0, 3).map(async (claim) => {
              const evidence = await fetchJson(`/evidence?claimId=${claim.claimId}&limit=20`).then((body) => body.items ?? []).catch(() => []);
              const hydrated = await hydrateEvidenceLinks(API, evidence);
              const counts = {};
              for (const relation of ['supports', 'refutes', 'qualifies', 'reproduces']) {
                counts[relation] = hydrated.filter((item) => evidenceRelations(item).includes(relation)).length;
              }
              const detail = await fetchJson(`/claims/${claim.claimId}`).catch(() => null);
              return { ...claim, currentRevision: detail?.currentRevision ?? null, evidenceCounts: counts };
            }));
            const [questionDetail, creation, project] = await Promise.all([
              fetchJson(`/questions/${question.questionId}`).catch(() => null),
              fetchJson(`/events?objectType=question&objectId=${question.questionId}&order=asc&limit=5`)
                .then((body) => (body.items ?? []).find((event) => event.eventType === 'question.created') ?? null).catch(() => null),
              fetchJson(`/projects/${question.projectId}`).catch(() => null),
            ]);
            const contributor = creation?.payload?.drafted_by_actor_id ?? creation?.payload?.producer_actor_id ?? question.createdBy ?? null;
            const signer = creation?.payload?.publisher_actor_id ?? null;
            setExample({
              question: { ...question, currentRevision: questionDetail?.currentRevision ?? null },
              projectName: project?.currentRevision?.name ?? null,
              claims: enriched,
              frontier,
              contributor,
              signer,
            });
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
    return (
      <div aria-busy="true" aria-label="Loading a public research example" className="border-t border-foreground pt-4">
        <Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-7 w-4/5" /><Skeleton className="mt-2 h-7 w-3/5" /><Skeleton className="mt-6 h-16 w-full" />
      </div>
    );
  }
  if (!example) return fallback;

  const { question, claims, frontier, contributor, signer, projectName } = example;
  const revision = question.currentRevision ?? question;

  return (
    <ExampleExcerpt
      cells={[
        { label: 'Project', value: projectName ? <Link className="hover:underline" href={`/projects/${question.projectId}`}>{projectName}</Link> : null },
        { label: 'Drafted by', value: contributor ? <ActorName actorId={contributor} /> : null },
        { label: 'Signed by', value: signer ? <ActorName actorId={signer} showOwner={false} /> : null },
      ]}
      footer={(
        <>
          <Identifier value={question.questionId} />
          <Link className="font-medium text-primary hover:underline" href={`/questions/${question.questionId}`}>Open question</Link>
        </>
      )}
      kind="Question"
      status={<StatusBadge state={question.state} />}
      title={revision.title ?? revision.statement ?? question.questionId}
    >
      <ul>
        {claims.map((claim) => {
          const statement = claim.currentRevision?.statement ?? claim.statement ?? null;
          return (
            <ExampleClaimRow href={`/claims/${claim.claimId}`} key={claim.claimId} state={claim.state} statement={statement ?? claim.claimId}>
              {claim.evidenceCounts && Object.values(claim.evidenceCounts).some((count) => count > 0) ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                  {['supports', 'refutes', 'qualifies', 'reproduces'].map((relation) => (claim.evidenceCounts[relation] > 0
                    ? <Link className="hover:text-foreground hover:underline" href={`/claims/${claim.claimId}`} key={relation}>{relation} {claim.evidenceCounts[relation]}</Link>
                    : null))}
                </p>
              ) : null}
            </ExampleClaimRow>
          );
        })}
      </ul>
    </ExampleExcerpt>
  );
}
