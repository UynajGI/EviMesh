'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdmissionFault, AdmissionSessionBoundary } from '@/components/admission-session';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/data';
import { Identifier, MarginSection } from '@/components/ui/doc';
import { Confirm } from '@/components/ui/dialog';
import { Empty, Skeleton } from '@/components/ui/feedback';
import { FieldGroup, Textarea } from '@/components/ui/form';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { createAdmissionClient } from '@/lib/admission-client.mjs';
import { parseExportedPublicKey } from '@/lib/signing-key-import.mjs';

/*
 * Signing keys (06-personal-ui-spec §4, public product v1). Human signing keys
 * are created and held by `sq key create` on the local device. This page only
 * registers the exported public half, lists registered keys, and revokes them.
 * It never generates, receives, or stores private key material.
 */

function shortDate(value) {
  return value ? String(value).slice(0, 10) : 'not stated';
}

function KeyRow({ signingKey, onRevoke }) {
  const revoked = Boolean(signingKey.revokedAt);
  return (
    <li className="grid gap-x-6 gap-y-2 border-b border-border py-3 md:grid-cols-[6rem_minmax(0,1fr)_auto] md:items-start">
      <div><StatusBadge label={revoked ? 'revoked' : 'active'} state={revoked ? 'archived' : 'completed'} /></div>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium">{signingKey.label || 'Signing key'}</span>
          <Identifier value={signingKey.keyId} />
        </p>
        <p className="mt-1 break-all font-mono text-xs tabular-nums text-muted-foreground" title="Fingerprint">{signingKey.fingerprint ?? 'fingerprint not stated'}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          registered {shortDate(signingKey.createdAt)}
          {revoked ? ` · revoked ${shortDate(signingKey.revokedAt)}${signingKey.revocationReason ? ` · ${signingKey.revocationReason}` : ''}` : ''}
        </p>
      </div>
      <div>{!revoked ? <Button className="text-destructive" onClick={() => onRevoke(signingKey)} size="sm" variant="outline">Revoke</Button> : null}</div>
    </li>
  );
}

function SigningKeys({ session }) {
  const [keys, setKeys] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [exported, setExported] = useState('');
  const [registerError, setRegisterError] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const payload = await createAdmissionClient(session).signingKeys.list();
      setKeys(Array.isArray(payload?.items) ? payload.items : []);
    } catch (reason) {
      setLoadError(reason);
      setKeys([]);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function register(event) {
    event.preventDefault();
    setRegisterError(null);
    setNotice(null);
    let parsed;
    try {
      parsed = parseExportedPublicKey(exported);
    } catch (reason) {
      setRegisterError(reason);
      return;
    }
    setRegistering(true);
    try {
      await createAdmissionClient(session).signingKeys.register(parsed);
      setExported('');
      setNotice(`Registered ${parsed.keyId}.`);
      await load();
    } catch (reason) {
      setRegisterError(reason);
    } finally {
      setRegistering(false);
    }
  }

  async function revoke() {
    setRevoking(true);
    try {
      await createAdmissionClient(session).signingKeys.revoke(revokeTarget.keyId, 'revoked by owner');
      setRevokeTarget(null);
      await load();
    } catch (reason) {
      setLoadError(reason);
      setRevokeTarget(null);
    } finally {
      setRevoking(false);
    }
  }

  const active = (keys ?? []).filter((entry) => !entry.revokedAt);

  return (
    <div className="doc-grid mt-6">
      <div className="doc-main grid gap-8">
      <section aria-labelledby="keys-registered-heading">
        <SectionHeader action={<span className="tabular-nums text-muted-foreground">{keys ? keys.length : ''}</span>} id="keys-registered-heading" title="Registered keys" />
        <AdmissionFault error={loadError} onRetry={load} />
        {keys === null ? <Skeleton className="mt-4 h-32 w-full" /> : keys.length === 0 ? (
          <Empty className="border-0 py-3" title="No signing keys yet" />
        ) : <ul>{keys.map((entry) => <KeyRow key={entry.keyId} onRevoke={setRevokeTarget} signingKey={entry} />)}</ul>}
      </section>

      <section aria-labelledby="keys-register-heading">
        <SectionHeader id="keys-register-heading" title="Register a public key" />
        <ol className="mt-3 grid list-decimal gap-1 pl-5 text-sm leading-6">
          <li><code className="font-mono text-xs">sq key create</code> on the device you sign from</li>
          <li><code className="font-mono text-xs">sq key export-public</code></li>
          <li>Paste the output below</li>
        </ol>
        {active.length > 0 ? <p className="mt-2 text-sm text-muted-foreground">One key can be active at a time. Revoke the current key first.</p> : null}
        <form className="mt-4 grid max-w-2xl gap-4" onSubmit={register}>
          <FieldGroup help="Never paste a private key." htmlFor="keys-exported" label="Exported public key">
            <Textarea className="min-h-40 font-mono text-xs" id="keys-exported" onChange={(event) => setExported(event.target.value)} spellCheck={false} value={exported} />
          </FieldGroup>
          <div><Button disabled={!exported.trim()} loading={registering} type="submit">Register public key</Button></div>
          {registerError && !registerError.status ? <p className="text-sm text-destructive" role="alert">{registerError.message}</p> : null}
          <AdmissionFault error={registerError?.status ? registerError : null} />
          {notice ? <p aria-live="polite" className="text-sm text-muted-foreground">{notice}</p> : null}
        </form>
      </section>
      </div>

      <aside aria-label="About signing keys" className="doc-margin">
        <MarginSection title="Rotation">
          <p className="text-[13px] leading-5">Register a new key; old keys stay valid until revoked.</p>
        </MarginSection>
      </aside>

      <Confirm
        confirmLabel="Revoke key"
        description={`New signatures from ${revokeTarget?.keyId ?? ''} will be rejected. Records it already signed keep their history.`}
        destructive
        loading={revoking}
        onConfirm={revoke}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
        open={Boolean(revokeTarget)}
        title="Revoke this signing key?"
      />
    </div>
  );
}

export default function SigningKeysPage() {
  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Account', href: '/settings' }, { label: 'Signing keys' }]} />
      <PageHeader title="Signing keys" />
      <AdmissionSessionBoundary returnTo="/settings/keys">
        {(session) => <SigningKeys session={session} />}
      </AdmissionSessionBoundary>
    </PageContainer>
  );
}
