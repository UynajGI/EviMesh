'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/data';
import { MarginSection } from '@/components/ui/doc';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { FALLBACK_PUBLIC_CAPABILITIES, fetchPublicCapabilities } from '@/lib/public-capabilities';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    title: 'Choose a client',
    description: 'MCP client, sq CLI, or SDK.',
  },
  {
    title: 'Sign in and grant least privilege',
    description: 'Browser sign-in through the device page.',
  },
  {
    title: 'Add the connection config',
    description: 'Paste the endpoint into your client config.',
  },
  {
    title: 'Test the connection',
    description: 'One handshake and a read-only capability check.',
  },
  {
    title: 'Read a real public question',
    description: 'Pull scope, frontier and open tasks.',
  },
  {
    title: 'Check provenance and continue',
    description: 'Verify revisions and signatures, then resume from a handoff sheet.',
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
  { name: 'search_open_tasks', kind: 'Discovery', write: 'read', capability: 'read', note: 'Open tasks for attempts' },
  { name: 'get_task_context', kind: 'Discovery', write: 'read', capability: 'read', note: 'Immutable ContextBundle for one task' },
  { name: 'create_claim', kind: 'Draft', write: 'confirm', capability: 'prepare', note: 'Prepare a canonical claim draft' },
  { name: 'submit_signed_research', kind: 'Submit', write: 'external-signature', capability: 'submit', note: 'Relay an envelope already signed on the human local device' },
  { name: 'attach_evidence', kind: 'Publish', write: 'confirm', capability: 'submit', note: 'Bind evidence to a claim revision' },
  { name: 'submit_verification', kind: 'Publish', write: 'confirm', capability: 'submit', note: 'Relay a signed VerificationReceipt' },
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
  const [capabilities, setCapabilities] = useState(null);
  /* Live grants (mockup 当前授权): personal access tokens with their scopes
   * and last activity, read through the signed-in session. */
  const [grants, setGrants] = useState('signed-out');
  const effectiveCapabilities = capabilities ?? FALLBACK_PUBLIC_CAPABILITIES;
  const connectionReady = effectiveCapabilities.deviceAuthorization.enabled && effectiveCapabilities.clients.mcp.available;
  const doneThrough = connectionReady ? 3 : 0;

  useEffect(() => {
    let cancelled = false;
    fetchPublicCapabilities().then((value) => {
      if (!cancelled) setCapabilities(value);
    });
    return () => { cancelled = true; };
  }, []);

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

  const channel = capabilities === null ? 'checking' : effectiveCapabilities.releaseChannel === 'ga' ? 'generally available' : effectiveCapabilities.releaseChannel === 'beta' ? 'public beta' : 'public preview';

  return (
    <PageContainer>
      <PageHeader title="Agent access" />
      <p aria-live="polite" className="mt-3 flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted-foreground">
        <span className="text-foreground">{channel}</span>
        <span aria-hidden="true">·</span>
        <span>{connectionReady ? 'device sign-in and MCP client available' : 'Public research remains readable; clients and submission not yet public'}</span>
      </p>

      <div className="doc-grid mt-6">
        <div className="doc-main grid gap-8">
          <section aria-labelledby="ac-connect-heading" id="ac-connect">
            <SectionHeader id="ac-connect-heading" title="Connection steps" />
            <ol aria-label="Agent connection stepper" className="stepper">
              {STEPS.map((step, index) => {
                const done = index < doneThrough;
                const current = index === doneThrough;
                return (
                  <li aria-current={current ? 'step' : undefined} className="stepper__item grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-3 border-b border-border py-2.5" key={step.title}>
                    <span className={cn('text-sm tabular-nums', current ? 'font-semibold text-primary' : 'text-muted-foreground')}>{index + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm"><span className="font-medium">{step.title}</span> <span className="text-muted-foreground">{step.description}</span></p>
                      {current && index === 2 && connectionReady ? (
                        <div className="mt-2">
                          <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
                            <span className="font-mono text-xs text-muted-foreground">mcp.json</span>
                            <button className="text-sm text-primary hover:underline" onClick={copyConfig} type="button">
                              {copied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <pre className="mt-2 overflow-x-auto rounded-[2px] border border-border bg-muted p-3 font-mono text-xs leading-5">{MCP_CONFIG}</pre>
                        </div>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {done ? <span className="text-status-success-fg">done</span> : current ? 'next' : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="ac-clients-heading" id="ac-clients">
            <SectionHeader id="ac-clients-heading" title="Choose a client" />
            <ul>
              {[
                { title: 'MCP clients', client: effectiveCapabilities.clients.mcp, body: 'Codex, Claude, Cursor', recommended: connectionReady },
                { title: 'sq CLI', client: effectiveCapabilities.clients.cli, body: 'Local review and signing' },
                { title: 'SDK', client: effectiveCapabilities.clients.sdk, body: 'Custom Agent pipelines' },
              ].map(({ title, client, body, recommended }) => (
                <li className="grid gap-x-4 gap-y-1 border-b border-border py-2.5 md:grid-cols-[minmax(0,1fr)_auto]" key={title}>
                  <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{title}</span>
                    <span className="text-muted-foreground">{body}</span>
                    {recommended ? <Badge variant="status-accent">recommended path</Badge> : null}
                  </p>
                  <p className="text-[13px] text-muted-foreground md:text-right">
                    {client.available ? <>from <span className="font-mono text-xs text-foreground">{client.minimumVersion}</span></> : 'not released'}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="read-with-agent-heading" id="ac-read">
            <SectionHeader id="read-with-agent-heading" title="Tools" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Tool</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Category</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Write level</th>
                    <th scope="col" className="py-2 font-medium">What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {TOOL_CATALOG.map((tool) => {
                    const toolEnabled = tool.capability === 'read'
                      ? effectiveCapabilities.research.read
                      : effectiveCapabilities.research[tool.capability];
                    return (
                      <tr className="border-b border-border" key={tool.name}>
                        <td className="py-2 pr-4 font-mono text-xs">{tool.name}</td>
                        <td className="py-2 pr-4">{tool.kind}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={toolEnabled ? writeVariant[tool.write] : 'status-neutral'}>
                            {toolEnabled ? tool.write === 'read' ? 'read-only' : tool.write === 'confirm' ? 'prepare only' : 'external signature' : 'not enabled'}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">{tool.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="agent-security-heading" id="ac-security">
            <SectionHeader id="agent-security-heading" title="Active grants" />
            {/* Live grants: real personal access tokens from the signed-in
                session; scopes, last activity, revoke inline. */}
            {grants === 'signed-out' ? (
              <p className="py-3 text-sm text-muted-foreground">Sign in to see your live grants</p>
            ) : grants === 'unavailable' ? (
              <p className="py-3 text-sm text-muted-foreground">Grants unavailable</p>
            ) : grants.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No active tokens</p>
            ) : (
              <ul aria-label="Active grants">
                {grants.map((grant) => (
                  <li className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border py-2.5" key={grant.tokenId}>
                    <span className="font-mono text-sm tabular-nums">{grant.tokenPrefix}</span>
                    <span className="font-mono text-xs text-muted-foreground">{(grant.scopes ?? []).join(' · ')}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">last used {grant.lastUsedAt ? String(grant.lastUsedAt).slice(0, 10) : 'never'}</span>
                    <Link className="text-[13px] text-primary hover:underline" href="/settings/tokens">adjust scope</Link>
                    <Button onClick={() => revokeGrant(grant)} size="sm" variant="outline">Revoke</Button>
                  </li>
                ))}
              </ul>
            )}
            <Link className="mt-2 inline-block text-sm text-primary hover:underline" href="/settings/tokens">Review or revoke tokens and scopes in Settings</Link>
          </section>
        </div>

        <aside aria-label="Agent connection reference" className="doc-margin">
          <MarginSection title="Agent manual">
            <p className="flex min-w-0 items-baseline gap-3">
              <Link className="min-w-0 truncate font-mono text-xs text-foreground hover:underline" href="/agent.md" title={AGENT_MANUAL_URL}>{AGENT_MANUAL_URL}</Link>
              <button className="shrink-0 text-[13px] text-primary hover:underline" onClick={copyManualUrl} type="button">
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </p>
          </MarginSection>
          <MarginSection title="Endpoint">
            <code className="font-mono text-xs text-foreground">https://api.evimesh.com</code>
          </MarginSection>
          <MarginSection title="Related">
            <ul className="grid gap-1 text-[13px]">
              <li><Link className="text-primary hover:underline" href="/device">Device access</Link></li>
              <li><Link className="text-primary hover:underline" href="/agents">My Agents</Link></li>
              <li><Link className="text-primary hover:underline" href="/settings/keys">Signing keys</Link></li>
            </ul>
          </MarginSection>
        </aside>
      </div>
    </PageContainer>
  );
}
