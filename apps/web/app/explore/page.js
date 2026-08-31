import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/ui/page';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

const SOURCES = Object.freeze([
  { type: 'question', path: '/questions?limit=40', idKey: 'questionId', hrefPrefix: '/questions' },
  { type: 'answer', path: '/answers?limit=40', idKey: 'answerId', hrefPrefix: '/answers' },
  { type: 'claim', path: '/claims?limit=40', idKey: 'claimId', hrefPrefix: '/claims' },
  { type: 'rebuttal', path: '/rebuttals?limit=40', idKey: 'rebuttalId', hrefPrefix: '/rebuttals' },
  { type: 'evaluation', path: '/evaluations?limit=40', idKey: 'evaluationId', hrefPrefix: '/evaluations' },
  { type: 'evidence', path: '/evidence?limit=40', idKey: 'evidenceId', hrefPrefix: '/evidence' },
  { type: 'dataset', path: '/datasets?limit=40', idKey: 'datasetId', hrefPrefix: '/datasets' },
  { type: 'tool', path: '/tools?limit=40', idKey: 'toolId', hrefPrefix: '/tools' },
  { type: 'run', path: '/runs?limit=40', idKey: 'runId', hrefPrefix: '/runs' },
]);

function text(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? null;
}

async function readSource(source) {
  if (!API) return [];
  try {
    const response = await fetch(`${API}${source.path}`, { cache: 'no-store' });
    if (!response.ok) return [];
    const body = await response.json();
    const rows = Array.isArray(body) ? body : body.items ?? [];
    return rows.map((row) => {
      const id = text(row[source.idKey], row.nodeId, row.objectId, row.id);
      if (!id) return null;
      const revision = row.currentRevision ?? row.revisionData ?? {};
      return {
        id,
        type: source.type,
        label: text(row.label, row.title, row.statement, row.name, revision.label, revision.title, revision.statement, revision.name, id),
        summary: text(row.summary, row.description, revision.summary, revision.description, revision.synthesis, revision.rationale),
        state: text(row.state, row.status, revision.state, 'not stated'),
        projectId: text(row.projectId, revision.projectId),
        revision: row.revision ?? row.revisionNumber ?? revision.revision ?? null,
        createdAt: text(row.createdAt, revision.createdAt),
        href: text(row.canonicalHref, revision.canonicalHref) ?? `${source.hrefPrefix}/${encodeURIComponent(id)}`,
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function readable(value) {
  return String(value).replaceAll('_', ' ');
}

function facetHref(type, query) {
  const params = new URLSearchParams();
  if (type !== 'all') params.set('type', type);
  if (query) params.set('q', query);
  const suffix = params.toString();
  return suffix ? `/explore?${suffix}` : '/explore';
}

export default async function ExplorePage({ searchParams }) {
  const params = await searchParams;
  const selectedType = SOURCES.some(({ type }) => type === params?.type) ? params.type : 'all';
  const query = text(params?.q)?.toLowerCase() ?? '';
  const groups = await Promise.all(SOURCES.map(readSource));
  const counts = new Map(SOURCES.map((source, index) => [source.type, groups[index].length]));
  const allItems = groups.flat().sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0));
  const visible = allItems
    .filter((item) => selectedType === 'all' || item.type === selectedType)
    .filter((item) => !query || `${item.label} ${item.summary ?? ''} ${item.id} ${item.projectId ?? ''}`.toLowerCase().includes(query));

  return (
    <PageContainer wide>
      <PageHeader description="Browse the attributable record across reasoning, resources and execution. Every row opens one stable research object." eyebrow="Explore" title="Follow the research, object by object." />
      <section className="grid min-w-0 grid-cols-12 border-y border-foreground" aria-label="Research object facets">
        <p className="col-span-12 border-b border-border px-3 py-3 font-mono text-[10px] font-bold uppercase text-primary lg:col-span-2 lg:border-r lg:border-b-0">OBJECT TYPE</p>
        <nav className="col-span-12 flex min-w-0 overflow-x-auto lg:col-span-10" aria-label="Filter by research object type">
          <Link aria-current={selectedType === 'all' ? 'page' : undefined} className="inline-flex min-h-11 shrink-0 items-center border-r border-border px-3 font-mono text-[10px] font-bold uppercase aria-[current=page]:bg-foreground aria-[current=page]:text-background" href={facetHref('all', query)}>All <span className="ml-2 text-primary">{allItems.length}</span></Link>
          {SOURCES.map(({ type }) => <Link aria-current={selectedType === type ? 'page' : undefined} className="inline-flex min-h-11 shrink-0 items-center border-r border-border px-3 font-mono text-[10px] font-bold uppercase aria-[current=page]:bg-foreground aria-[current=page]:text-background" href={facetHref(type, query)} key={type}>{readable(type)} <span className="ml-2 text-primary">{counts.get(type)}</span></Link>)}
        </nav>
      </section>
      <form action="/explore" className="grid min-w-0 grid-cols-12 border-b border-foreground" method="get" role="search">
        {selectedType !== 'all' ? <input name="type" type="hidden" value={selectedType} /> : null}
        <label className="col-span-12 flex min-w-0 items-center gap-3 px-3 sm:col-span-9"><Search aria-hidden="true" className="shrink-0 text-primary" size={15} /><span className="sr-only">Search research objects</span><input className="min-h-12 min-w-0 flex-1 bg-transparent font-serif text-base outline-none placeholder:text-muted-foreground" defaultValue={params?.q ?? ''} name="q" placeholder="Search title, stable ID, project or statement" /></label>
        <button className="col-span-12 min-h-12 border-t border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary hover:bg-foreground hover:text-background sm:col-span-3 sm:border-l sm:border-t-0" type="submit">Search the record</button>
      </form>

      <section className="grid min-w-0 grid-cols-12 gap-y-8 py-10 lg:gap-x-8" aria-label="Research objects">
        <aside className="col-span-12 min-w-0 border-b border-foreground pb-6 lg:col-span-3 lg:border-r lg:border-b-0 lg:pr-6"><p className="font-mono text-[10px] font-bold uppercase text-primary">VISIBLE SCOPE</p><h2 className="mt-3 font-serif text-3xl font-medium tracking-[-0.035em]">{selectedType === 'all' ? 'All research objects' : readable(selectedType)}</h2><p className="mt-4 max-w-[30ch] text-sm leading-6 text-muted-foreground">Ordered by recorded time within the bounded responses returned by each object endpoint.</p>{selectedType === 'tool' ? <Link className="mt-6 inline-flex min-h-11 w-full items-center justify-between border border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary" href="/tools">Open Tool directory <ArrowUpRight aria-hidden="true" size={14} /></Link> : null}</aside>
        <div className="col-span-12 min-w-0 lg:col-span-9">
          {visible.length === 0 ? <div className="border-y border-foreground py-14"><h2 className="font-serif text-3xl font-medium">No visible objects match this scope.</h2><p className="mt-3 text-sm text-muted-foreground">Try a different type or a broader text query.</p></div> : <ol className="m-0 list-none border-t border-foreground p-0">{visible.map((item, index) => <li className="grid min-w-0 grid-cols-12 gap-y-3 border-b border-border py-6" key={`${item.type}:${item.id}`}><span className="col-span-2 font-mono text-[10px] text-primary sm:col-span-1">{String(index + 1).padStart(2, '0')}</span><div className="col-span-10 min-w-0 sm:col-span-7"><p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">{readable(item.type)} / {readable(item.state)}</p><Link className="mt-2 block font-serif text-2xl font-medium leading-tight tracking-[-0.025em] [overflow-wrap:anywhere] hover:text-primary" href={item.href}>{item.label}</Link>{item.summary ? <p className="mt-2 max-w-[62ch] font-serif text-sm leading-6 text-muted-foreground">{item.summary}</p> : null}</div><div className="col-span-10 col-start-3 min-w-0 font-mono text-[9px] leading-5 text-muted-foreground sm:col-span-4 sm:col-start-auto sm:text-right"><code className="[overflow-wrap:anywhere]">{item.id}{item.revision ? `@r${item.revision}` : ''}</code><p>{item.projectId ?? 'project not stated'}</p><time dateTime={item.createdAt ?? undefined}>{item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : 'date not stated'}</time></div></li>)}</ol>}
        </div>
      </section>
    </PageContainer>
  );
}
