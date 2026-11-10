'use client';

import { useEffect, useState } from 'react';
import { Button, buttonLinkVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/data';
import { ActorName, MarginSection } from '@/components/ui/doc';
import { Confirm } from '@/components/ui/dialog';
import { DeniedState, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

async function call(path, options = {}) {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`, { ...options, headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message);
  return body;
}

export default function TokensPage() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  async function load() {
    setError(null);
    try {
      /* No session is a scope boundary, not a server failure (08 §1 denied):
       * name it and offer the re-authentication path. */
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      if (!data.session) { setNeedsAuth(true); setTokens([]); return; }
      setNeedsAuth(false);
      setTokens(await call('/api-tokens'));
    } catch (reason) { setError(reason.message); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function revoke() {
    setRevoking(true);
    try {
      await call(`/api-tokens/${revokeTarget.tokenId}`, { method: 'DELETE', body: JSON.stringify({ reason: 'revoked by owner in account settings' }) });
      setRevokeTarget(null);
      load();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Account', href: '/settings' }, { label: 'API tokens' }]} />
      <PageHeader title="API tokens" />
      <div className="doc-grid mt-6">
        <div className="doc-main">
          {error ? <ErrorState className="mb-6" message={error} onRetry={load} /> : null}
          {needsAuth ? (
            <DeniedState
              description="Sign in to manage tokens."
              scope="authenticated session"
              title="Re-authentication needed"
              action={<a className={buttonLinkVariants({ size: 'sm' })} href="/login">Sign in</a>}
              actionLabel="Sign in"
            />
          ) : null}
          {loading ? <Skeleton className="h-48 w-full" /> : !needsAuth ? (
            <section aria-labelledby="tokens-heading">
              <SectionHeader action={<span className="tabular-nums text-muted-foreground">{tokens.length}</span>} id="tokens-heading" title="Tokens" />
              {tokens.length === 0 ? (
                <Empty
                  className="border-0 py-3"
                  action={<a className={buttonLinkVariants({ size: 'sm', variant: 'outline' })} href="/agent">Connect an agent first</a>}
                  title="No tokens yet"
                />
              ) : <ul>{tokens.map((token) => {
                const revoked = Boolean(token.revokedAt);
                const expired = !revoked && token.expiresAt && Date.parse(token.expiresAt) < Date.now();
                const status = revoked ? 'revoked' : expired ? 'expired' : 'active';
                return <li className="grid gap-x-6 gap-y-2 border-b border-border py-3 md:grid-cols-[6rem_minmax(0,1fr)_auto] md:items-start" key={token.tokenId}>
                  <div><StatusBadge label={status} state={revoked || expired ? 'archived' : 'completed'} /></div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-sm tabular-nums">{token.tokenPrefix}</span>
                      {token.agentActorId ? <span className="text-sm text-muted-foreground">for <ActorName actorId={token.agentActorId} showOwner={false} /></span> : null}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{(token.scopes ?? []).join(' · ')}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
                      {token.expiresAt ? <span>expires {String(token.expiresAt).slice(0, 10)}</span> : <span>never expires</span>}
                      <span>last used {token.lastUsedAt ? String(token.lastUsedAt).slice(0, 10) : 'never'}</span>
                    </p>
                  </div>
                  <div>{!revoked ? <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRevokeTarget(token)}>Revoke</Button> : null}</div>
                </li>;
              })}</ul>}
            </section>
          ) : null}
        </div>
        <aside aria-label="How tokens are issued" className="doc-margin">
          <MarginSection title="Issuing">
            <p className="text-[13px] leading-5">Tokens are issued by an approved Agent connection.</p>
            <a className="mt-1.5 inline-block text-[13px] text-primary hover:underline" href="/agent">Connect an Agent</a>
          </MarginSection>
        </aside>
      </div>
      <Confirm open={Boolean(revokeTarget)} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }} title="Revoke this token?" description={`The token ${revokeTarget?.tokenPrefix ?? ''} will stop working immediately and cannot be restored.`} confirmLabel="Revoke token" destructive onConfirm={revoke} loading={revoking} />
    </PageContainer>
  );
}
