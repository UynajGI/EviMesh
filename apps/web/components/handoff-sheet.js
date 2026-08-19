'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';

/*
 * Agent handoff sheet (M13.8 07-emerging-ui-spec.md §1): the default write
 * interaction on the web. Carries intent, exact object, view, and a return
 * path; never credentials. The CLI reads auth from its own local config and
 * MCP clients use their own security context.
 */
function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    setTimeout(() => setCopied(null), 1400);
  }
  return (
    <button
      aria-label={copied === true ? `Copied ${label}` : `Copy ${label}`}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      onClick={copy}
      type="button"
    >
      {copied === true ? <Check aria-hidden="true" size={12} /> : <Copy aria-hidden="true" size={12} />}
      Copy
    </button>
  );
}

export function HandoffSheet({
  open,
  onOpenChange,
  intent,
  objectType,
  objectId,
  revision,
  view,
  scopes = [],
  cliCommand,
  mcpCall,
  taskPrompt,
}) {
  const [permalink, setPermalink] = useState('');
  useEffect(() => {
    if (open && typeof window !== 'undefined') setPermalink(window.location.href);
  }, [open, objectId, revision]);

  const naturalLanguage = taskPrompt
    ?? `Read ${permalink}. ${intent} for ${objectType} ${objectId}${revision ? ` at revision ${revision}` : ''}. Draft the result and wait for human sign-off before publishing; do not publish directly.`;
  const cli = cliCommand ?? `sq ${objectType} inspect ${objectId}${revision ? ` --rev ${revision}` : ''}`;
  const mcp = mcpCall ?? `resource: evimesh://${objectType}s/${objectId}${revision ? `?rev=${revision}` : ''}`;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent aria-describedby="handoff-description" className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agent handoff</p>
        <h2 className="mt-1 text-lg font-semibold">{intent}</h2>
        <p className="mt-1 text-sm text-muted-foreground" id="handoff-description">
          This sheet carries the intent, the exact object, and a return path. It never carries credentials.
        </p>

        <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-5">
          <dt className="text-muted-foreground">Object</dt>
          <dd className="flex flex-wrap items-center gap-2"><IdChip value={objectId} />{revision ? <span className="font-mono text-xs text-muted-foreground">r{revision}</span> : null}</dd>
          <dt className="text-muted-foreground">View</dt><dd>{view ?? 'default'}</dd>
          <dt className="text-muted-foreground">Permalink</dt>
          <dd className="min-w-0"><span className="block truncate font-mono text-xs text-muted-foreground" title={permalink}>{permalink || 'current page'}</span></dd>
          {scopes.length > 0 ? (
            <>
              <dt className="text-muted-foreground">Scopes</dt>
              <dd className="font-mono text-xs">{scopes.join(' · ')}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Return path</dt>
          <dd className="font-mono text-xs text-muted-foreground">continuation: {permalink || 'this page'}</dd>
        </dl>

        <div className="mt-5 grid gap-4">
          <div>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Natural-language task</span><CopyButton label="task" value={naturalLanguage} /></div>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs leading-5 whitespace-pre-wrap">{naturalLanguage}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested CLI</span><CopyButton label="CLI command" value={cli} /></div>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-5">{cli}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested MCP</span><CopyButton label="MCP call" value={mcp} /></div>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-5">{mcp}</pre>
          </div>
        </div>

        <Alert
          className="mt-5"
          description="The CLI reads auth from its local config; MCP clients use their own security context. Tokens never appear in handoffs, URLs, or logs."
          title="No credentials travel with this handoff"
          variant="info"
        />
      </DialogContent>
    </Dialog>
  );
}
