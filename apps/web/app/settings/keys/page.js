'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

const base64url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

/*
 * Signing keys (M13.8 06-personal-ui-spec.md §4): the human signing key that
 * publishes what agents draft. Rotation registers a new key; the previous key
 * stays valid until revoked, so in-flight signatures never break mid-flight.
 */
export default function SigningKeysPage() {
  const [message, setMessage] = useState(null);

  async function register() {
    try {
      const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
      const publicKey = base64url(await crypto.subtle.exportKey('spki', pair.publicKey));
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/signing-keys`, { method: 'POST', headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ keyId: crypto.randomUUID(), publicKey }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      setMessage(`Registered ${payload.keyId}. Private key never left this browser.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Account security</p>
      <h1 className="mt-3 text-4xl font-semibold">Signing key</h1>
      <p className="mt-5 text-muted-foreground">Generate an Ed25519 keypair and register only its public key with EviMesh. This is the key that signs publications drafted by you or your agents.</p>
      <Button className="mt-7" onClick={register}>Generate and register key</Button>
      {message ? <p aria-live="polite" className="mt-5 text-sm text-muted-foreground">{message}</p> : null}
      <Alert
        className="mt-8"
        description="To rotate, register a new key above: old keys stay valid for in-flight signatures until you revoke them from the API. A key list endpoint and an active-session view ship with the auth surface; until then, this page registers and rotates keys only."
        title="Rotation keeps old keys until revoked"
        variant="info"
      />
    </main>
  );
}
