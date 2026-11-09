import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/data';
import { Input } from '@/components/ui/form';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils';

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

/* A label is research words only when it is not a bare identifier, and not a
 * generated "stance: <id>" line (evaluation list labels). */
function words(...values) {
  const value = text(...values);
  if (!value) return null;
  if (/^[a-z]+_[0-9a-f-]{8,}$/i.test(value) || /^[a-z_ ]+: [a-z]+_[0-9a-f-]{8,}$/i.test(value)) return null;
  return value;
}

const HYDRATE_LIMIT = 30;

/* List endpoints carry no statements or titles. Read the words of the rows
 * that will render from their detail endpoints, bounded and in parallel;
 * any failure keeps the list row as it was. */
async function hydrateItem(item) {
  const source = SOURCES.find(({ type }) => type === item.type);
  if (!API || !source || item.label) return item;
  try {
    const response = await fetch(`${API}${source.hrefPrefix}/${encodeURIComponent(item.id)}`, { cache: 'no-store' });
    if (!response.ok) return item;
    const body = await response.json();
    const revision = body.currentRevision ?? {};
    const record = body[item.type] ?? {};
    const label = words(revision.title, revision.statement, revision.name, record.title, record.statement, record.name, revision.rationale, revision.argument, revision.synthesis, record.summary, record.description, revision.label, record.label);
    const summary = text(item.summary, label === revision.title ? revision.statement : null, revision.synthesis, revision.argument, label === revision.rationale ? revision.method : revision.rationale, revision.description, record.description);
    return { ...item, label, summary: summary && summary !== label ? summary : null, revision: item.revision ?? revision.revision ?? null };
  } catch {
    return item;
  }
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
        label: words(row.label, row.title, row.statement, row.name, revision.label, revision.title, revision.statement, revision.name),
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

/* Same shape as shortId in components/ui/doc.js (a client module). */
function shortId(value) {
  if (!value) return '';
  const underscore = value.indexOf('_');
  const head = underscore > 0 ? value.slice(0, underscore + 7) : value.slice(0, 7);
  return value.length > head.length + 4 ? `${head}…${value.slice(-4)}` : value;
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

const FACET_CLASS = 'inline-flex min-h-11 shrink-0 items-baseline gap-1.5 border-b-2 border-transparent px-1 pt-3 pb-2 text-sm font-medium capitalize text-muted-foreground hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground';

export default async function ExplorePage({ searchParams }) {
  const params = await searchParams;
  const selectedType = SOURCES.some(({ type }) => type === params?.type) ? params.type : 'all';
  const query = text(params?.q)?.toLowerCase() ?? '';
  const groups = await Promise.all(SOURCES.map(readSource));
  const counts = new Map(SOURCES.map((source, index) => [source.type, groups[index].length]));
  const allItems = groups.flat().sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0));
  const typed = allItems.filter((item) => selectedType === 'all' || item.type === selectedType);
  const hydrated = await Promise.all(typed.slice(0, HYDRATE_LIMIT).map(hydrateItem));
  const visible = [...hydrated, ...typed.slice(HYDRATE_LIMIT)]
    .filter((item) => !query || `${item.label ?? ''} ${item.summary ?? ''} ${item.id} ${item.projectId ?? ''}`.toLowerCase().includes(query));

  return (
    <PageContainer wide>
      <PageHeader title="Explore" />

      <section aria-label="Research object facets" className="mt-2 border-b border-border">
        <nav aria-label="Filter by research object type" className="flex min-w-0 gap-5 overflow-x-auto">
          <Link aria-current={selectedType === 'all' ? 'page' : undefined} className={FACET_CLASS} href={facetHref('all', query)}>All <span className="font-normal tabular-nums text-muted-foreground">{allItems.length}</span></Link>
          {SOURCES.map(({ type }) => <Link aria-current={selectedType === type ? 'page' : undefined} className={FACET_CLASS} href={facetHref(type, query)} key={type}>{readable(type)} <span className="font-normal tabular-nums text-muted-foreground">{counts.get(type)}</span></Link>)}
        </nav>
      </section>

      <form action="/explore" className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center" method="get" role="search">
        {selectedType !== 'all' ? <input name="type" type="hidden" value={selectedType} /> : null}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search research objects</span>
          <Input defaultValue={params?.q ?? ''} name="q" placeholder="Search title, stable ID, project or statement" type="search" />
        </label>
        <button className={cn(buttonVariants({ variant: 'outline' }), 'shrink-0')} type="submit">Search</button>
      </form>

      <section aria-labelledby="results-heading" className="mt-8">
        <SectionHeader
          action={(
            <span className="flex flex-wrap items-baseline gap-x-4 text-muted-foreground">
              <span className="tabular-nums">{visible.length} shown</span>
              {selectedType === 'tool' ? <Link className="text-primary hover:underline" href="/tools">Tool directory</Link> : null}
            </span>
          )}
          id="results-heading"
          title={selectedType === 'all' ? 'All objects' : <span className="capitalize">{readable(selectedType)}</span>}
        />

        {visible.length === 0 ? (
          <p className="border-b border-border py-5 text-sm font-medium">Nothing matches</p>
        ) : (
          <ul>
            {visible.map((item) => (
              <li className="ref-row" key={`${item.type}:${item.id}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 md:block">
                  <p className="text-sm capitalize text-muted-foreground">{readable(item.type)}</p>
                  {item.state !== 'not stated' ? <StatusBadge className="md:mt-1" state={item.state} /> : null}
                </div>
                <div className="min-w-0">
                  {item.label ? (
                    <Link className="ref-row__title [overflow-wrap:anywhere] hover:underline" href={item.href}>{item.label}</Link>
                  ) : (
                    <Link className="block font-mono text-sm text-muted-foreground hover:text-foreground hover:underline" href={item.href} title={item.id}>{shortId(item.id)}{item.revision ? `@r${item.revision}` : ''}</Link>
                  )}
                  {item.summary ? <p className="mt-1 line-clamp-2 max-w-[64ch] font-serif text-sm leading-6 text-muted-foreground">{item.summary}</p> : null}
                  {item.label || item.projectId ? (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {item.label ? <span className="font-mono" title={item.id}>{shortId(item.id)}{item.revision ? `@r${item.revision}` : ''}</span> : null}
                      {item.projectId ? <Link className="hover:text-foreground hover:underline" href={`/projects/${encodeURIComponent(item.projectId)}`} title={item.projectId}><span className="font-mono">{shortId(item.projectId)}</span></Link> : null}
                    </p>
                  ) : null}
                </div>
                <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={item.createdAt ?? undefined}>{item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : null}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
