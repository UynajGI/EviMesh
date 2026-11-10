import Link from 'next/link';
import { StatusBadge } from '@/components/ui/data';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { shortId } from '@/lib/short-id.mjs';

async function readAnswers() {
  const base = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
  if (!base) return [];
  try {
    const response = await fetch(`${base}/answers?limit=50`, { cache: 'no-store' });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body.items) ? body.items : [];
  } catch {
    return [];
  }
}


function dateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString().slice(0, 10);
}

export default async function AnswersPage() {
  const answers = await readAnswers();
  return (
    <PageContainer wide>
      <PageHeader title="Answers" />
      <section aria-labelledby="answers-heading" className="mt-6">
        <SectionHeader action={<span className="tabular-nums text-muted-foreground">{answers.length}</span>} className="sr-only" id="answers-heading" title="Answers" />
        {answers.length === 0 ? (
          <p className="border-b border-border py-5 text-sm font-medium">No answers yet</p>
        ) : (
          <ul>
            {answers.map((answer) => {
              const id = answer.answerId ?? answer.nodeId ?? answer.id;
              const revision = answer.currentRevision ?? answer.revisionData ?? {};
              const words = revision.statement ?? revision.title ?? answer.statement ?? answer.title ?? null;
              const state = answer.state ?? answer.status ?? null;
              return (
                <li className="ref-row" key={id}>
                  <div>{state ? <StatusBadge state={state} /> : null}</div>
                  <div className="min-w-0">
                    {words ? (
                      <Link className="ref-row__title [overflow-wrap:anywhere] hover:underline" href={`/answers/${encodeURIComponent(id)}`}>{words}</Link>
                    ) : (
                      <Link className="block font-mono text-sm text-muted-foreground hover:text-foreground hover:underline" href={`/answers/${encodeURIComponent(id)}`} title={id}>{shortId(id)}</Link>
                    )}
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {words ? <span className="font-mono" title={id}>{shortId(id)}</span> : null}
                      {revision.revision != null ? <span className="tabular-nums">r{revision.revision}</span> : null}
                    </p>
                  </div>
                  <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={answer.createdAt ?? revision.createdAt ?? undefined}>{dateLabel(answer.createdAt ?? revision.createdAt)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
