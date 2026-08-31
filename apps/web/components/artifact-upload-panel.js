import Link from 'next/link';

export function ArtifactUploadPanel() {
  return <section className="mt-8 border-y border-foreground py-8" aria-label="Artifact upload handoff"><p className="font-mono text-[10px] font-bold uppercase text-primary">LOCAL TRANSFER ONLY</p><h2 className="mt-3 font-serif text-3xl font-medium tracking-[-0.03em]">Hash and upload through your Agent.</h2><p className="mt-3 max-w-[62ch] text-sm leading-6 text-muted-foreground">The public website does not receive research files. The CLI hashes the Artifact locally, transfers it, and binds its immutable reference to the signed record.</p><pre className="mt-5 overflow-x-auto border-y border-border py-4 font-mono text-xs"><code>sq evidence add ./artifact.bin</code></pre><Link className="mt-5 inline-flex min-h-11 items-center border border-foreground px-4 font-mono text-[10px] font-bold uppercase text-primary" href="/agent">Open Agent connection</Link></section>;
}
