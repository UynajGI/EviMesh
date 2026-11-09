'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Identifier } from '@/components/ui/doc';

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
      className="inline-flex h-7 items-center text-[13px] text-primary hover:underline"
      onClick={copy}
      type="button"
    >
      {copied === true ? 'Copied' : 'Copy'}
    </button>
  );
}

export function HandoffSheet({
  open,
  onOpenChange,
  intent,
  objectType,
  objectId,
  objectTitle,
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
        <h2 className="border-b border-border pb-2 pr-6 text-[0.9375rem] font-semibold">{intent}</h2>
        <p className="sr-only" id="handoff-description">Handoff for your Agent. No credentials included.</p>

        <dl className="mt-3 grid gap-1.5 border-b border-border pb-3 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-5">
          <dt className="text-muted-foreground">Object</dt>
          <dd className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              {objectTitle ? <span className="min-w-0 max-w-[42ch] truncate font-serif font-medium" title={objectTitle}>{objectTitle}</span> : null}
              <Identifier value={objectId} />
              {revision ? <span className="font-mono text-xs text-muted-foreground">r{revision}</span> : null}
            </span>
          </dd>
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

        <div className="mt-4 grid min-w-0 gap-3 [&>div]:min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium">Task</span><CopyButton label="task" value={naturalLanguage} /></div>
            <pre className="mt-1 overflow-x-auto rounded-[2px] border border-border bg-muted p-2.5 text-xs leading-5 whitespace-pre-wrap">{naturalLanguage}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium">CLI</span><CopyButton label="CLI command" value={cli} /></div>
            <pre className="mt-1 overflow-x-auto rounded-[2px] border border-border bg-muted p-2.5 font-mono text-xs leading-5">{cli}</pre>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium">MCP</span><CopyButton label="MCP call" value={mcp} /></div>
            <pre className="mt-1 overflow-x-auto rounded-[2px] border border-border bg-muted p-2.5 font-mono text-xs leading-5">{mcp}</pre>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            className="text-[13px] text-primary hover:underline"
            onClick={() => {
              const payload = { intent, objectType, objectId, revision: revision ?? null, view: view ?? null, permalink, scopes, cli, mcp, task: naturalLanguage, continuation: permalink };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `evimesh-handoff-${objectType}-${objectId}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            type="button"
          >
            Download handoff JSON
          </button>
          {/* Primary action: one obvious way back to the page. */}
          <button
            className="inline-flex h-9 items-center justify-center rounded-[2px] bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={() => onOpenChange?.(false)}
            type="button"
          >
            Done, back to the page
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">No credentials included.</p>
      </DialogContent>
    </Dialog>
  );
}
