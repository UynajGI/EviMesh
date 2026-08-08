'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/data';
import { Confirm } from '@/components/ui/dialog';
import { Alert, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Label } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Checkbox } from '@/components/ui/selection';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

const TOKEN_SCOPES = ['profile:read', 'project:read', 'claim:read', 'task:read'];

async function call(path, options = {}) {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`, { ...options, headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message);
  return body;
}

export default function TokensPage() {
  const [tokens, setTokens] = useState([]);
  const [secret, setSecret] = useState(null);
  const [scopes, setScopes] = useState(['profile:read']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  async function load() {
    setError(null);
    try { setTokens(await call('/api-tokens')); } catch (reason) { setError(reason.message); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    setCreating(true);
    setCopied(false);
    try {
      const result = await call('/api-tokens', { method: 'POST', body: JSON.stringify({ scopes }) });
      setSecret(result.token);
      load();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setCreating(false);
    }
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
  }

  async function revoke() {
    setRevoking(true);
    try {
      await call(`/api-tokens/${revokeTarget.tokenId}`, { method: 'DELETE' });
      setRevokeTarget(null);
      load();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setRevoking(false);
    }
  }

  const toggleScope = (scope) => (event) => setScopes((current) => event.target.checked ? [...current, scope] : current.filter((value) => value !== scope));

  return <PageContainer><PageHeader eyebrow="Account security" title="API tokens" description="Create scoped tokens for the SDK and CLI. A new token is shown exactly once." />
    {error ? <ErrorState className="mt-8" message={error} onRetry={load} /> : null}
    {loading ? <Skeleton className="mt-8 h-48 w-full" /> : <>
      <section className="mt-8 rounded-lg border border-border bg-card p-5" aria-labelledby="create-token-heading">
        <h2 id="create-token-heading" className="text-lg font-semibold">Create a token</h2>
        <fieldset className="mt-4 grid gap-3 sm:grid-cols-2"><legend className="text-sm font-medium">Scopes</legend>{TOKEN_SCOPES.map((scope) => <label className="flex items-center gap-2 text-sm" key={scope}><Checkbox checked={scopes.includes(scope)} onChange={toggleScope(scope)} />{scope}</label>)}</fieldset>
        <Button className="mt-5" onClick={create} loading={creating}>Create token</Button>
        {secret ? <div className="mt-5"><Alert variant="info" title="Copy this token now" description="It cannot be shown again." /><div className="mt-3 flex flex-wrap items-center gap-3"><code className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs tabular-nums">{secret}</code><Button variant="outline" size="sm" onClick={copySecret}>{copied ? 'Copied' : 'Copy token'}</Button></div></div> : null}
      </section>
      <section className="mt-8" aria-labelledby="tokens-heading">
        <h2 id="tokens-heading" className="text-lg font-semibold">Active tokens</h2>
        {tokens.length === 0 ? <Empty className="mt-4" title="No tokens yet" description="Tokens you create for the SDK and CLI will appear here." /> : <ul className="mt-4 space-y-3">{tokens.map((token) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4" key={token.tokenId}><div><p className="font-mono text-sm tabular-nums">{token.tokenPrefix}</p><div className="mt-2 flex flex-wrap gap-2">{(token.scopes ?? []).map((scope) => <Badge key={scope} variant="info">{scope}</Badge>)}{token.expiresAt ? <span className="text-xs tabular-nums text-muted-foreground">expires {token.expiresAt}</span> : <span className="text-xs text-muted-foreground">never expires</span>}</div></div><Button size="sm" variant="outline" className="text-destructive" onClick={() => setRevokeTarget(token)}>Revoke</Button></li>)}</ul>}
      </section>
    </>}
    <Confirm open={Boolean(revokeTarget)} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }} title="Revoke this token?" description={`The token ${revokeTarget?.tokenPrefix ?? ''} will stop working immediately and cannot be restored.`} confirmLabel="Revoke token" destructive onConfirm={revoke} loading={revoking} />
  </PageContainer>;
}
