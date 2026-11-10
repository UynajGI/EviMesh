import Link from 'next/link';
import { StatusBadge } from '@/components/ui/data';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { shortId } from '@/lib/short-id.mjs';

const FACETS = ['all', 'skill', 'method', 'software', 'model', 'workflow'];

async function readTools() {
  const base = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
  if (!base) return [];
  try {
    const response = await fetch(`${base}/tools?limit=50`, { cache: 'no-store' });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body.items) ? body.items : [];
  } catch {
    return [];
  }
}


function normalizeTool(row) {
  const revision = row.currentRevision ?? {};
  const id = row.toolId ?? row.nodeId ?? row.id;
  return {
    id,
    href: row.canonicalHref ?? revision.canonicalHref ?? `/tools/${encodeURIComponent(id)}`,
    title: row.title ?? row.name ?? revision.title ?? revision.name ?? revision.label ?? shortId(id),
    type: row.toolType ?? row.toolKind ?? row.kind ?? revision.toolType ?? revision.toolKind ?? 'software',
    capability: row.capability ?? row.description ?? revision.description ?? null,
    interfaceLabel: row.interface ?? row.interfaces?.join(' / ') ?? revision.runtime ?? null,
    revision: row.nodeRevision ?? row.revision ?? revision.revision ?? null,
    state: row.state ?? row.status ?? 'published',
    createdAt: row.createdAt ?? revision.createdAt ?? null,
  };
}

const FACET_CLASS = 'inline-flex min-h-11 shrink-0 items-baseline border-b-2 border-transparent px-1 pt-3 pb-2 text-sm font-medium capitalize text-muted-foreground hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground';

export default async function ToolsPage({ searchParams }) {
  const params = await searchParams;
  const active = FACETS.includes(params?.type) ? params.type : 'all';
  const tools = (await readTools()).map(normalizeTool).filter((tool) => tool.id && (active === 'all' || tool.type === active));

  return (
    <PageContainer wide>
      <PageHeader title="Tools" />
      <nav aria-label="Tool type" className="mt-2 flex min-w-0 gap-5 overflow-x-auto border-b border-border">
        {FACETS.map((facet) => <Link aria-current={active === facet ? 'page' : undefined} className={FACET_CLASS} href={facet === 'all' ? '/tools' : `/tools?type=${facet}`} key={facet}>{facet === 'all' ? 'All' : facet}</Link>)}
      </nav>

      <section aria-labelledby="tools-heading" className="mt-8">
        <SectionHeader
          action={<span className="tabular-nums text-muted-foreground">{tools.length}</span>}
          id="tools-heading"
          title={active === 'all' ? 'All tools' : <span className="capitalize">{active}</span>}
        />
        {tools.length === 0 ? (
          <p className="border-b border-border py-5 text-sm font-medium">No tools yet</p>
        ) : (
          <ul>
            {tools.map((tool) => (
              <li className="ref-row" key={tool.id}>
                <div className="flex flex-wrap items-baseline gap-x-2 md:block">
                  <p className="text-sm capitalize text-muted-foreground">{tool.type}</p>
                  <StatusBadge className="md:mt-1" state={tool.state} />
                </div>
                <div className="min-w-0">
                  <Link className="ref-row__title [overflow-wrap:anywhere] hover:underline" href={tool.href}>{tool.title}</Link>
                  {tool.capability ? <p className="mt-1 max-w-[64ch] font-serif text-sm leading-6 text-muted-foreground">{tool.capability}</p> : null}
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span className="font-mono" title={tool.id}>{shortId(tool.id)}{tool.revision != null ? `@r${tool.revision}` : ''}</span>
                    {tool.interfaceLabel ? <span>{tool.interfaceLabel}</span> : null}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground md:text-right">{tool.createdAt && !Number.isNaN(Date.parse(tool.createdAt)) ? new Date(tool.createdAt).toISOString().slice(0, 10) : null}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
