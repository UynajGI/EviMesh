import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/ui/page';

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
    title: row.title ?? row.name ?? revision.title ?? revision.name ?? revision.label ?? id,
    type: row.toolType ?? row.toolKind ?? row.kind ?? revision.toolType ?? revision.toolKind ?? 'software',
    capability: row.capability ?? row.description ?? revision.description ?? 'Capability description not stated.',
    interfaceLabel: row.interface ?? row.interfaces?.join(' / ') ?? revision.runtime ?? 'Not stated',
    revision: row.nodeRevision ?? row.revision ?? revision.revision ?? null,
    state: row.state ?? row.status ?? 'published',
  };
}

export default async function ToolsPage({ searchParams }) {
  const params = await searchParams;
  const active = FACETS.includes(params?.type) ? params.type : 'all';
  const tools = (await readTools()).map(normalizeTool).filter((tool) => tool.id && (active === 'all' || tool.type === active));

  return (
    <PageContainer wide>
      <PageHeader
        description="This index contains versioned Tool nodes. Datasets remain discoverable through Explore and research neighborhoods."
        eyebrow="Research instrument index"
        title="Methods you can inspect."
        titleClassName="sm:max-w-none sm:whitespace-nowrap"
      />
      <nav aria-label="Tool type" className="mt-6 flex flex-wrap gap-1 border-b border-foreground pb-4">
        {FACETS.map((facet) => <Link aria-current={active === facet ? 'page' : undefined} className={`min-h-11 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] transition-colors ${active === facet ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`} href={facet === 'all' ? '/tools' : `/tools?type=${facet}`} key={facet}>{facet === 'all' ? 'All tools' : facet}</Link>)}
      </nav>
      <div className="mt-6 hidden grid-cols-12 gap-4 border-b border-foreground pb-3 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground md:grid"><span className="col-span-3">Tool</span><span className="col-span-5">Capability</span><span className="col-span-2">Interface</span><span className="col-span-2">Revision</span></div>
      {tools.length === 0 ? (
        <section className="grid min-h-72 grid-cols-12 items-center border-b border-foreground py-10">
          <div className="col-span-12 min-w-0 md:col-start-4 md:col-span-6"><p className="font-serif text-2xl font-medium">No Tool nodes are published in this scope.</p><p className="mt-3 max-w-[48ch] text-sm leading-6 text-muted-foreground">Connect an Agent to inspect Tool contracts through CLI or MCP. The web surface remains read-only.</p><Link className="mt-6 inline-flex min-h-11 items-center border border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary hover:bg-foreground hover:text-background" href="/agent">Open Agent connection →</Link></div>
        </section>
      ) : (
        <div>{tools.map((tool) => <article className="grid min-w-0 grid-cols-12 gap-3 border-b border-border py-6 md:gap-4" key={tool.id}><div className="col-span-12 min-w-0 md:col-span-3"><span className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-primary">Tool / {tool.type}</span><h2 className="mt-2 font-serif text-2xl font-medium tracking-[-0.03em] [overflow-wrap:anywhere]"><Link className="hover:text-primary" href={tool.href}>{tool.title}</Link></h2><code className="mt-2 block text-[10px] text-muted-foreground [overflow-wrap:anywhere]">{tool.id}</code></div><p className="col-span-12 min-w-0 font-serif text-base leading-7 text-muted-foreground md:col-span-5">{tool.capability}</p><p className="col-span-6 font-mono text-[10px] uppercase text-muted-foreground md:col-span-2">{tool.interfaceLabel}</p><p className="col-span-6 font-mono text-[10px] uppercase text-muted-foreground md:col-span-2">{tool.revision != null ? `r${tool.revision}` : 'revision n/a'} / {tool.state}</p></article>)}</div>
      )}
    </PageContainer>
  );
}
