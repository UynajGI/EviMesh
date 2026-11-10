import Link from 'next/link';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { MarginSection } from '@/components/ui/doc';

/* Verification receipts are prepared by an Agent and signed on the human's
 * local device; the web shows the handoff and links to the record. */
export default function VerificationPage() {
  return (
    <PageContainer>
      <PageHeader title="Verification" />
      <div className="doc-grid mt-6">
        <section aria-label="Verification receipt handoff" className="doc-main">
          <SectionHeader title="Submit a receipt" />
          <ol className="grid list-decimal gap-1 pl-5 pt-3 text-sm leading-6">
            <li>Your Agent prepares the receipt</li>
            <li>You check it, then sign it on your own device</li>
            <li>The CLI or MCP submits the signed envelope</li>
          </ol>
          <pre className="mt-4 overflow-x-auto rounded-[2px] border border-border bg-muted p-3 font-mono text-xs leading-5"><code>sq verify submit ./verification-receipt.json</code></pre>
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link className="text-primary hover:underline" href="/agent">Agent connection</Link>
            <Link className="text-primary hover:underline" href="/verification/receipt/new">New receipt</Link>
          </p>
        </section>
        <aside aria-label="Related" className="doc-margin">
          <MarginSection title="Related">
            <ul className="grid gap-1 text-[13px]">
              <li><Link className="text-primary hover:underline" href="/explore">Explore claims</Link></li>
              <li><Link className="text-primary hover:underline" href="/docs/getting-started/verifier">Verifier guide</Link></li>
            </ul>
          </MarginSection>
        </aside>
      </div>
    </PageContainer>
  );
}
