import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/ui/page';

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

export default async function AnswersPage() {
  const answers = await readAnswers();
  return <PageContainer wide><PageHeader eyebrow="Answer index" title="Published answers." description="Read answers in publication order, then open their heterogeneous research neighborhoods." /><div className="mt-8 border-t border-foreground">{answers.length === 0 ? <p className="border-b border-foreground py-14 font-serif text-2xl">No Answer nodes are published in this scope.</p> : answers.map((answer) => { const id = answer.answerId ?? answer.nodeId ?? answer.id; const revision = answer.currentRevision ?? answer.revisionData ?? {}; const title = revision.statement ?? revision.title ?? answer.statement ?? answer.title ?? id; return <article className="grid min-w-0 grid-cols-12 gap-4 border-b border-border py-6" key={id}><div className="col-span-12 min-w-0 sm:col-span-2"><span className="font-mono text-[9px] font-bold uppercase text-primary">Answer</span><code className="mt-2 block text-[10px] text-muted-foreground [overflow-wrap:anywhere]">{id}</code></div><div className="col-span-12 min-w-0 sm:col-span-8"><h2 className="font-serif text-2xl font-medium tracking-[-0.03em] [overflow-wrap:anywhere]">{title}</h2><p className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">{answer.state ?? answer.status ?? 'state not stated'} / {revision.revision != null ? `r${revision.revision}` : 'revision n/a'}</p></div><Link className="col-span-12 inline-flex min-h-11 items-center justify-between self-center border border-foreground px-3 font-mono text-[10px] font-bold uppercase text-primary hover:bg-foreground hover:text-background sm:col-span-2" href={`/answers/${encodeURIComponent(id)}`}>Open <span>→</span></Link></article>; })}</div></PageContainer>;
}
