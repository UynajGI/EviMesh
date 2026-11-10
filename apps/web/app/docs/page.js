import Link from 'next/link';
import { loadDocsManifest } from '@/lib/docs-content.mjs';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';

export const metadata = {
  title: 'Docs · EviMesh',
  description: 'Product documentation for EviMesh: researcher, agent developer, and verifier paths over a protocol you can verify yourself.',
};

/*
 * Docs home (docs-plan.md §4.1): task entries for the audiences, then the
 * full IA grouped by section. No popularity ordering, no view counts, no
 * completion meters: position in the IA is the only navigation signal.
 */
const AUDIENCE_ENTRIES = [
  {
    href: '/docs/getting-started/researcher',
    title: 'I read and follow research',
    body: 'Read a question, its claims, evidence and receipts.',
    label: 'Researcher',
  },
  {
    href: '/docs/getting-started/agent-developer',
    title: 'I build agents that draft',
    body: 'Connect through MCP or the CLI and draft under scopes.',
    label: 'Agent developer',
  },
  {
    href: '/docs/getting-started/verifier',
    title: 'I verify claims',
    body: 'Record what you observed on a signed receipt.',
    label: 'Verifier',
  },
  {
    href: '/docs/reference/api',
    title: 'I integrate with the protocol',
    body: 'API, MCP, CLI and SDK references.',
    label: 'Integration',
  },
];

export default async function DocsHomePage() {
  const { sections } = await loadDocsManifest();

  return (
    <PageContainer wide>
      <PageHeader title="Documentation" />

      <section aria-labelledby="paths-heading" className="mt-6">
        <SectionHeader id="paths-heading" title="Start here" />
        <ul>
          {AUDIENCE_ENTRIES.map((entry) => (
            <li className="ref-row" key={entry.href}>
              <p className="text-sm text-muted-foreground">{entry.label}</p>
              <p className="min-w-0 text-sm">
                <Link className="font-medium text-foreground hover:underline" href={entry.href}>{entry.title}</Link>
                <span className="ml-2 text-muted-foreground">{entry.body}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sections-heading" className="mt-8">
        <SectionHeader id="sections-heading" title="All documentation" />
        <div className="doc-grid mt-4">
          <div className="doc-main grid min-w-0 gap-6 md:grid-cols-2 md:gap-8">
            {sections.map((section) => (
              <section aria-labelledby={`home-${section.id}`} key={section.id}>
                <h3 className="text-[13px] font-semibold text-muted-foreground" id={`home-${section.id}`}>{section.title}</h3>
                <ul className="mt-1 grid list-none">
                  {section.pages.map((page) => (
                    <li className="border-b border-border last:border-b-0" key={page.slug}>
                      <Link className="flex min-h-9 items-center justify-between gap-3 py-1.5 text-sm hover:underline" href={`/docs/${page.slug}`}>
                        <span className="min-w-0 truncate text-foreground">{page.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{page.audience === 'agent-developer' ? 'agent' : page.audience}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <aside aria-label="Machine-readable docs" className="doc-margin margin-section lg:sticky lg:top-20 lg:self-start">
            <h2>Machine-readable</h2>
            <ul className="grid list-none gap-1 text-[13px]">
              <li><a className="text-primary hover:underline" href="/agent.md">Agent manual (Markdown)</a></li>
              <li className="break-all"><a className="text-primary hover:underline" href="/openapi.json" rel="noopener noreferrer" target="_blank">OpenAPI contract</a></li>
            </ul>
          </aside>
        </div>
      </section>
    </PageContainer>
  );
}
