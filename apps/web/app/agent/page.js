'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bot, Check, Code, FileText, Plug, TerminalSquare } from 'lucide-react';
import { Alert } from '@/components/ui/feedback';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    title: 'Choose a client',
    description: 'MCP-capable clients (Codex, Claude, Cursor), the sq CLI, or the SDK for your own pipelines.',
  },
  {
    title: 'Sign in and grant least privilege',
    description: 'Browser-based sign-in first; tokens are the advanced path for automation, never the first step.',
  },
  {
    title: 'Add the connection config',
    description: 'Paste the server endpoint into your client config. Examples use placeholders only, never real credentials.',
  },
  {
    title: 'Test the connection',
    description: 'One handshake and a read-only capability negotiation; failures show their reason inline.',
  },
  {
    title: 'Read a real public question',
    description: 'Point your agent at a live question to pull scope, frontier, and open tasks.',
  },
  {
    title: 'Check provenance and continue',
    description: 'Verify revisions, policy, and signatures, then resume work from a handoff sheet.',
  },
];

const MCP_CONFIG = `{
  "mcpServers": {
    "evimesh": {
      "command": "npx",
      "args": ["-y", "@evimesh/mcp"],
      "env": {
        "EVIMESH_API_URL": "https://api.evimesh.com",
        "EVIMESH_TOKEN": "<your-least-privilege-token>"
      }
    }
  }
}`;

const TOOL_CATALOG = [
  { name: 'search_open_tasks', kind: 'Discovery', write: 'read', note: 'Open tasks for attempts' },
  { name: 'get_task_context', kind: 'Discovery', write: 'read', note: 'Immutable ContextBundle for one task' },
  { name: 'create_claim', kind: 'Draft', write: 'confirm', note: 'Write a claim draft; requires confirm: true' },
  { name: 'publish_submission', kind: 'Publish', write: 'confirm-sign', note: 'Sign and submit; confirm plus a human signing key' },
  { name: 'attach_evidence', kind: 'Publish', write: 'confirm', note: 'Bind evidence to a claim revision' },
  { name: 'submit_verification', kind: 'Publish', write: 'confirm', note: 'Submit a signed VerificationReceipt' },
];

const writeVariant = { read: 'status-success', confirm: 'status-warning', 'confirm-sign': 'emphasis-danger' };

/*
 * Agent connection center (M13.8 06-personal-ui-spec.md §3): the path from
 * "heard about EviMesh" to "my agent made one trusted read". The manual itself
 * stays a direct Markdown document at /agent.md (canonical URL below, as
 * introduced by the onboarding split on main).
 */
const AGENT_MANUAL_URL = 'https://www.evimesh.com/agent.md';

export default function AgentCenterPage() {
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [doneThrough, setDoneThrough] = useState(2);

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(MCP_CONFIG);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  async function copyManualUrl() {
    try {
      await navigator.clipboard.writeText(AGENT_MANUAL_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setCopiedUrl(false);
    }
  }

  return (
    <PageContainer wide>
      <PageHeader
        action={(
          <div className="flex max-w-md items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
            <Link className="min-w-0 truncate font-mono text-xs text-muted-foreground hover:text-foreground" href="/agent.md" title={AGENT_MANUAL_URL}>{AGENT_MANUAL_URL}</Link>
            <button
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={copyManualUrl}
              type="button"
            >
              {copiedUrl ? <Check aria-hidden="true" size={12} /> : null}
              {copiedUrl ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        description="Every step is retryable and revocable. Config examples use placeholders; real credentials never appear on this page."
        eyebrow="Agent"
        title="Connect your agent"
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-label="Connection steps">
          <ol className="relative">
            {STEPS.map((step, index) => {
              const done = index < doneThrough;
              const current = index === doneThrough;
              return (
                <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4 pb-7" key={step.title}>
                  {index < STEPS.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-[0.9375rem] top-8 w-px bg-border" /> : null}
                  <span
                    aria-label={done ? 'done' : current ? 'current' : `step ${index + 1}`}
                    className={cn(
                      'z-10 grid size-8 place-items-center rounded-full border text-xs font-medium',
                      done ? 'border-status-success-border bg-status-success-bg text-status-success-fg' : current ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? <Check aria-hidden="true" size={14} /> : index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                    {current && index === 2 ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground">mcp.json</span>
                          <button className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={copyConfig} type="button">
                            {copied ? <Check aria-hidden="true" size={12} /> : null}
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-5">{MCP_CONFIG}</pre>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="grid gap-4" aria-label="Client and security">
          <div className="grid gap-3">
            {[
              { icon: Bot, title: 'MCP clients', body: 'Codex, Claude, Cursor via the connector config above.' },
              { icon: TerminalSquare, title: 'sq CLI', body: 'npm install --global @evimesh/cli, then sq config init.' },
              { icon: Code, title: 'SDK', body: 'Embed EviMesh objects into your own agent orchestration.' },
            ].map(({ icon: Icon, title, body }) => (
              <div className="flex gap-3 rounded-lg border border-border bg-card p-4" key={title}>
                <Icon aria-hidden="true" className="mt-0.5 text-muted-foreground" size={18} />
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tool catalog</h2>
            <p className="mt-1 text-xs text-muted-foreground">Names match the registered MCP tool definitions; write tools demand explicit consent. Frontiers are read as resources, for example evimesh://projects/&#123;projectId&#125;/frontier/latest.</p>
            <ul className="mt-3 divide-y divide-border">
              {TOOL_CATALOG.map((tool) => (
                <li className="flex flex-wrap items-center gap-2 py-2" key={tool.name}>
                  <code className="font-mono text-xs">{tool.name}</code>
                  <span className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    writeVariant[tool.write] === 'status-success' && 'border-status-success-border bg-status-success-bg text-status-success-fg',
                    writeVariant[tool.write] === 'status-warning' && 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
                    writeVariant[tool.write] === 'emphasis-danger' && 'border-transparent bg-emphasis-danger text-emphasis-foreground',
                  )}>
                    {tool.write === 'read' ? 'read-only' : tool.write === 'confirm' ? 'confirm required' : 'confirm + signature'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Alert
            description="Revoke or narrow grants from Settings at any time. Tokens are one-time-reveal secrets and never belong in URLs, logs, or handoffs."
            title="Revocable by design"
            variant="info"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText aria-hidden="true" size={14} />
            <span>Full protocol semantics: <Link className="text-primary hover:underline" href="/agent.md">the agent manual</Link>, served as Markdown for direct reading.</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Plug aria-hidden="true" size={14} />
            <span>Connection endpoint <IdChip value="https://api.evimesh.com" /></span>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
