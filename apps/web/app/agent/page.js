'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  { name: 'submit_signed_research', kind: 'Submit', write: 'external-signature', note: 'Submit an envelope already signed on the human local device' },
  { name: 'attach_evidence', kind: 'Publish', write: 'confirm', note: 'Bind evidence to a claim revision' },
  { name: 'submit_verification', kind: 'Publish', write: 'confirm', note: 'Submit a signed VerificationReceipt' },
];

const SECURITY_ROWS = [
  {
    title: 'Scopes are least-privilege by default',
    body: 'Read access covers public objects only. Draft scope lets an Agent prepare canonical work. A human reviews and signs on the local device before the Agent submits that existing envelope.',
  },
  {
    title: 'Revocation is one page away',
    body: 'Grants and personal access tokens are listed and revocable under Settings at any time. Revoking takes effect on the next request; drafts already published keep their attribution chain.',
  },
  {
    title: 'Tokens never travel in pages',
    body: 'Tokens and authorization credentials never appear in examples, URLs, logs, or handoff sheets. Every documented example uses environment-variable placeholders instead of real credentials.',
  },
];

const writeVariant = { read: 'status-success', confirm: 'status-warning', 'external-signature': 'emphasis-danger' };

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
  /* Live grants (mockup 当前授权): personal access tokens with their scopes
   * and last activity, read through the signed-in session. */
  const [grants, setGrants] = useState('signed-out');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let session = null;
      try {
        const { createBrowserSupabaseClient } = await import('@/lib/supabase-browser');
        ({ data: { session } } = await createBrowserSupabaseClient().auth.getSession());
      } catch { /* anonymous */ }
      if (!session) { if (!cancelled) setGrants('signed-out'); return; }
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/api-tokens`, { headers: { authorization: `Bearer ${session.access_token}` } });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? 'grants are unavailable');
        if (!cancelled) setGrants((payload.tokens ?? payload.items ?? []).filter((token) => !token.revokedAt));
      } catch {
        if (!cancelled) setGrants('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function revokeGrant(token) {
    try {
      const { createBrowserSupabaseClient } = await import('@/lib/supabase-browser');
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/api-tokens/${token.tokenId}`, { headers: { authorization: `Bearer ${data.session.access_token}` }, method: 'DELETE' });
      if (!response.ok) throw new Error('revoke failed');
      setGrants((current) => Array.isArray(current) ? current.filter((entry) => entry.tokenId !== token.tokenId) : current);
    } catch {
      /* the Settings page remains the authoritative revocation surface */
    }
  }

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

      {/* Mockup ac navlist: section anchors for the page's five surfaces. */}
      <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2 text-sm">
        {[
          ['#ac-connect', 'Connection steps'],
          ['#ac-clients', 'Choose a client'],
          ['#ac-read', 'Read with an agent'],
          ['#ac-security', 'Security and revocation'],
        ].map(([href, label]) => (
          <a className="rounded-md border border-border bg-card px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground" href={href} key={href}>{label}</a>
        ))}
      </nav>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-label="Connection steps" id="ac-connect">
          <ol aria-label="Agent connection stepper" className="stepper relative">
            {STEPS.map((step, index) => {
              const done = index < doneThrough;
              const current = index === doneThrough;
              return (
                <li className="stepper__item relative grid grid-cols-[2rem_minmax(0,1fr)] gap-4 pb-7" key={step.title}>
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
          <div className="grid gap-3" id="ac-clients">
            {[
              { icon: Bot, title: 'MCP clients', body: 'Codex, Claude, Cursor via the connector config above.', recommended: true },
              { icon: TerminalSquare, title: 'sq CLI', body: 'npm install --global @evimesh/cli, then sq config init.' },
              { icon: Code, title: 'SDK', body: 'Embed EviMesh objects into your own agent orchestration.' },
            ].map(({ icon: Icon, title, body, recommended }) => (
              <div className={cn('flex gap-3 rounded-lg border p-4', recommended ? 'border-primary bg-card' : 'border-border bg-card')} key={title}>
                <Icon aria-hidden="true" className="mt-0.5 text-muted-foreground" size={18} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {title}
                    {recommended ? <span className="rounded-full border border-status-accent-border bg-status-accent-bg px-2 py-0.5 text-[11px] font-medium text-status-accent-fg">recommended path</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tool catalog</h2>
            <p className="mt-1 text-xs text-muted-foreground">Full table under “Read with an agent” below; write tools demand explicit consent.</p>
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

      <section aria-labelledby="read-with-agent-heading" className="mt-12" id="ac-read">
        <h2 className="text-xl font-semibold tracking-tight" id="read-with-agent-heading">Read with an agent</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          An agent that never contributed to EviMesh can still read it correctly: object semantics, the four reading
          perspectives (Argument, Evidence, Verification, Frontier), which MCP resources are read-only discovery, which
          tools write and therefore require an explicit confirm, how to check revisions and signatures, and how to
          resume the same context from a web handoff sheet.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th scope="col" className="px-4 py-2.5 font-medium">Tool</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Category</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Write level</th>
                <th scope="col" className="px-4 py-2.5 font-medium">What it does</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {TOOL_CATALOG.map((tool) => (
                <tr key={tool.name}>
                  <td className="px-4 py-2.5 font-mono text-xs">{tool.name}</td>
                  <td className="px-4 py-2.5">{tool.kind}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      writeVariant[tool.write] === 'status-success' && 'border-status-success-border bg-status-success-bg text-status-success-fg',
                      writeVariant[tool.write] === 'status-warning' && 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
                      writeVariant[tool.write] === 'emphasis-danger' && 'border-transparent bg-emphasis-danger text-emphasis-foreground',
                    )}>
                      {tool.write === 'read' ? 'read-only' : tool.write === 'confirm' ? 'confirm required' : 'confirm + signature'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{tool.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="agent-security-heading" className="mt-12" id="ac-security">
        <h2 className="text-xl font-semibold tracking-tight" id="agent-security-heading">Security and revocation</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          The authorization model and your live grants.
        </p>

        {/* Mockup 当前授权 rowlist: real personal access tokens from the
            signed-in session; scopes, last activity, revoke inline. */}
        {grants === 'signed-out' ? (
          <p className="mt-4 rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
            Sign in to see your live grants.
          </p>
        ) : grants === 'unavailable' ? (
          <p className="mt-4 rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
            Grants are temporarily unavailable. <Link className="text-primary hover:underline" href="/settings/tokens">Review them in Settings →</Link>
          </p>
        ) : grants.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
            No active tokens.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card" aria-label="Active grants">
            {grants.map((grant) => (
              <li className="flex flex-wrap items-center gap-3 px-5 py-3.5" key={grant.tokenId}>
                <span className="font-mono text-sm tabular-nums">{grant.tokenPrefix}</span>
                <span className="font-mono text-xs text-muted-foreground">{(grant.scopes ?? []).join(' · ')}</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">last used {grant.lastUsedAt ? String(grant.lastUsedAt).slice(0, 10) : 'never'}</span>
                <Link className="text-xs text-primary hover:underline" href="/settings/tokens">adjust scope</Link>
                <button className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => revokeGrant(grant)} type="button">Revoke</button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-3">
          <Link className="text-sm font-medium text-primary hover:underline" href="/settings/tokens">Review or revoke tokens and scopes in Settings →</Link>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {SECURITY_ROWS.map((row) => (
            <div className="rounded-lg border border-border bg-card p-4" key={row.title}>
              <h3 className="text-sm font-semibold">{row.title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{row.body}</p>
            </div>
          ))}
        </div>
        <Alert
          className="mt-4"
          description="Tokens never appear in examples, URLs, logs, or handoffs; examples use environment-variable placeholders."
          title="Token hygiene"
          variant="info"
        />
      </section>
    </PageContainer>
  );
}
