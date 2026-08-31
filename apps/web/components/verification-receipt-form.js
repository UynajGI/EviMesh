import Link from 'next/link';

export function VerificationReceiptForm() {
  return <section className="mt-8 border-y border-foreground py-8" aria-label="Verification receipt handoff"><p className="font-mono text-[10px] font-bold uppercase text-primary">SIGNED OUTSIDE THE WEB</p><h2 className="mt-3 font-serif text-3xl font-medium tracking-[-0.03em]">Prepare the receipt through CLI or MCP.</h2><p className="mt-3 max-w-[62ch] text-sm leading-6 text-muted-foreground">The Agent prepares canonical bytes. A human reviews and signs them on the local device before submission.</p><pre className="mt-5 overflow-x-auto border-y border-border py-4 font-mono text-xs"><code>sq verify submit ./verification-receipt.json</code></pre><Link className="mt-5 inline-flex min-h-11 items-center border border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary" href="/agent">Open Agent connection</Link></section>;
}
