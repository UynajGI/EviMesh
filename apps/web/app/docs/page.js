import Link from 'next/link';
import { loadDocsManifest } from '@/lib/docs-content.mjs';
import { PageContainer } from '@/components/ui/page';

export const metadata = {
  title: 'Docs · EviMesh',
  description: 'Product documentation for EviMesh: researcher, agent developer, and verifier paths over a protocol you can verify yourself.',
};

/*
 * Docs home (docs-plan.md §4.1): task entries for the audiences, then the
 * full IA grouped by section. No popularity ordering, no view counts, no
 * completion meters - position in the IA is the only navigation signal.
 */
const AUDIENCE_ENTRIES = [
  {
    href: '/docs/getting-started/researcher',
    title: 'I read and follow research',
    body: 'Browse the index, open a question workspace, and read a claim\u2019s evidence and verification in one pass.',
    label: 'Researcher path',
  },
  {
    href: '/docs/getting-started/agent-developer',
    title: 'I build agents that draft',
    body: 'Connect through MCP or the CLI, draft under explicit scopes, and keep a human signature on every publication.',
    label: 'Agent developer path',
  },
  {
    href: '/docs/getting-started/verifier',
    title: 'I verify claims',
    body: 'Declare a context mode, record what you observed, and file typed findings on a signed receipt.',
    label: 'Verifier path',
  },
  {
    href: '/docs/reference/api',
    title: 'I integrate with the protocol',
    body: 'The API, MCP, CLI, and SDK references - generated from the same contract the platform ships.',
    label: 'Integration reference',
  },
];

export default async function DocsHomePage() {
  const { sections } = await loadDocsManifest();

  return (
    <PageContainer wide>
      <header className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-secondary-foreground">Docs</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Documentation</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          EviMesh records research as a graph of signed, immutable objects.
          Agents draft; humans sign. Counts open the underlying record -
          and the event chain lets you verify that yourself.
        </p>
      </header>

      <section aria-labelledby="paths-heading" className="mt-10">
        <h2 className="text-lg font-semibold" id="paths-heading">Start here</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {AUDIENCE_ENTRIES.map((entry) => (
            <Link
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/40"
              href={entry.href}
              key={entry.href}
            >
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{entry.label}</span>
              <span className="mt-1 block text-base font-semibold text-foreground group-hover:underline">{entry.title}</span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">{entry.body}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="sections-heading" className="mt-12">
        <h2 className="text-lg font-semibold" id="sections-heading">All documentation</h2>
        <div className="mt-6 grid gap-8 lg:[grid-template-columns:minmax(0,1fr)_18rem] lg:items-start lg:grid">
          <div className="grid min-w-0 gap-8 md:grid-cols-2 md:gap-8">
            {sections.map((section) => (
              <section aria-labelledby={`home-${section.id}`} className="border-t border-border pt-4" key={section.id}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground" id={`home-${section.id}`}>{section.title}</h3>
                <ul className="mt-3 grid list-none">
                  {section.pages.map((page) => (
                    <li className="border-b border-border last:border-b-0" key={page.slug}>
                      <Link className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-foreground" href={`/docs/${page.slug}`}>
                        <span className="min-w-0 truncate font-medium text-foreground">{page.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{page.audience === 'agent-developer' ? 'agent' : page.audience}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <aside aria-label="Machine-readable docs" className="border-t border-border pt-4 lg:sticky lg:top-20 lg:self-start">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Machine-readable</h3>
            <ul className="mt-3 grid list-none text-sm">
              <li><a className="hover:text-foreground hover:underline" href="/agent.md">Agent manual (Markdown)</a></li>
              <li className="mt-2 break-all"><a className="hover:text-foreground hover:underline" href="/openapi.json" rel="noopener noreferrer" target="_blank">OpenAPI contract</a></li>
            </ul>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">The same facts agents read - no parallel truth.</p>
          </aside>
        </div>
      </section>
    </PageContainer>
  );
}
