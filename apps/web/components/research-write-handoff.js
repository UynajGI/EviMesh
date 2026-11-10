import Link from 'next/link';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';

/*
 * Authoring handoff: the browser reads the research record; drafting,
 * signing and submission happen through an Agent connection, the CLI or MCP.
 * Server component, so dates and copy stay static. `description` is kept for
 * callers but not rendered.
 */
export function ResearchWriteHandoff({
  command = 'sq --help',
  kind = 'research object',
  title = 'Continue through your Agent',
}) {
  return (
    <PageContainer>
      <PageHeader title={title} />

      <div className="doc-grid mt-6">
        <section aria-label={`${kind} authoring handoff`} className="doc-main">
          <SectionHeader title="Agents prepare. Humans sign locally." />
          <ol className="grid list-decimal gap-1 pl-5 pt-3 text-sm leading-6">
            <li>Your Agent or the CLI prepares the {kind}</li>
            <li>You check it, then sign it on your own device</li>
            <li>The CLI or MCP submits the signed envelope</li>
          </ol>
          <nav aria-label="Authoring next steps" className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link className="inline-flex h-9 items-center rounded-[2px] bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90" href="/agent">Open Agent connection</Link>
            <Link className="text-sm text-primary hover:underline" href="/docs/concepts/attribution-and-signatures">Signing protocol</Link>
          </nav>
        </section>

        <aside aria-label="CLI and MCP handoff" className="doc-margin">
          <section className="margin-section">
            <h2>CLI</h2>
            <pre className="overflow-x-auto rounded-[2px] border border-border bg-muted p-3 font-mono text-xs leading-5"><code>{command}</code></pre>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
