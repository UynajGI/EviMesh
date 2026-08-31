import Link from 'next/link';
import { ArrowUpRight, Terminal } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/ui/page';

export function ResearchWriteHandoff({
  command = 'sq --help',
  description = 'The public website is a reading surface for the attributable research record.',
  eyebrow = 'Read-only research web',
  kind = 'research object',
  title = 'Continue through your Agent',
}) {
  return (
    <PageContainer wide>
      <PageHeader description={description} eyebrow={eyebrow} title={title} />
      <section className="grid min-w-0 grid-cols-12 gap-y-8 border-y border-foreground py-10 lg:gap-x-8" aria-label={`${kind} authoring handoff`}>
        <div className="col-span-12 min-w-0 lg:col-span-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary">AUTHORING BOUNDARY / {kind}</p>
          <h2 className="mt-4 max-w-[18ch] font-serif text-[clamp(2rem,5vw,4.75rem)] font-medium leading-[0.96] tracking-[-0.045em]">Agents prepare. Humans sign locally.</h2>
          <p className="mt-6 max-w-[62ch] font-serif text-lg leading-8 text-muted-foreground">Use the CLI or MCP connection to draft, validate and submit research. The browser does not hold a research signing flow or mutate the public record.</p>
        </div>
        <aside className="col-span-12 min-w-0 border-t border-foreground pt-5 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-label="CLI and MCP handoff">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary">CLI STARTING POINT</p>
          <pre className="mt-4 overflow-x-auto border-y border-border py-4 font-mono text-xs"><code>{command}</code></pre>
          <ol className="mt-5 grid gap-3 font-mono text-[10px] leading-5 text-muted-foreground">
            <li><span className="text-primary">01</span> Agent or CLI prepares canonical bytes.</li>
            <li><span className="text-primary">02</span> A human reviews and signs on the local device.</li>
            <li><span className="text-primary">03</span> CLI or MCP submits the signed envelope.</li>
          </ol>
        </aside>
      </section>
      <nav aria-label="Authoring next steps" className="grid min-w-0 grid-cols-12 border-b border-foreground">
        <Link className="col-span-12 flex min-h-14 items-center justify-between border-b border-border px-4 font-mono text-[10px] font-bold uppercase text-primary transition-[padding] duration-[160ms] hover:pl-[18px] sm:col-span-6 sm:border-b-0 sm:border-r" href="/agent"><span className="inline-flex items-center gap-2"><Terminal aria-hidden="true" size={14} />Open Agent connection</span><ArrowUpRight aria-hidden="true" size={14} /></Link>
        <Link className="col-span-12 flex min-h-14 items-center justify-between px-4 font-mono text-[10px] font-bold uppercase text-primary transition-[padding] duration-[160ms] hover:pl-[18px] sm:col-span-6" href="/docs/concepts/attribution-and-signatures">Read signing protocol <ArrowUpRight aria-hidden="true" size={14} /></Link>
      </nav>
    </PageContainer>
  );
}
