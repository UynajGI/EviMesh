import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, rawHash } from '../../../packages/protocol/src/hash.mjs';
import { generateEd25519KeyPair } from '../../../packages/signatures/src/ed25519.mjs';
import { signEd25519Payload } from '../../../packages/signatures/src/client-signature.mjs';
import { createResearchGraphEventVerifier } from '../src/research-graph-event-verifier.mjs';

async function signedEnvelope({ keyPair, keyId = 'key-human-1', payload, nonce = 'nonce-graph-0123456789' }) {
  const eventType = 'claim.created';
  const signingText = canonicalJson({ event_type: eventType, payload, nonce });
  return {
    schema: 'srp.client-signature-envelope.v1',
    event_type: eventType,
    payload,
    nonce,
    signing_bytes_hash: `sha256:${rawHash(signingText)}`,
    signature: {
      algorithm: 'Ed25519',
      key_id: keyId,
      value: await signEd25519Payload({
        signingBytes: new TextEncoder().encode(signingText),
        privateKey: keyPair.private_key,
      }),
    },
  };
}

function commandFor(envelope) {
  return {
    actorId: 'human-1',
    actorRole: 'maintainer',
    clientSignatureVerified: true,
    publisherSignatureEnvelope: envelope,
    claimId: 'claim-1',
    questionId: null,
    draftedByActorId: 'human-1',
    statement: 'A falsifiable statement.',
    scope: ['dataset'],
    assumptions: [],
    falsification: ['A failed reproduction'],
  };
}

function eventFor(command, envelope = command.publisherSignatureEnvelope) {
  return {
    event_id: '01993f21-16f8-7f01-8e42-0123456789ab',
    event_type: 'claim.created',
    payload: {
      entity_type: 'claim',
      claim_id: command.claimId,
      question_id: command.questionId,
      revision: 1,
      actor_id: command.actorId,
      signer_actor_id: command.actorId,
      drafted_by_actor_id: command.draftedByActorId,
      publisher_signature_envelope: envelope,
    },
    hash: `sha256:${'a'.repeat(64)}`,
    signature: { algorithm: 'Ed25519', key_id: 'event-key', value: 'event-factory-signature' },
    parents: [],
  };
}

function repositoryFor(keyPair, overrides = {}) {
  return {
    findActiveSigningKey: async () => ({
      keyId: 'key-human-1',
      actorId: 'human-1',
      algorithm: 'Ed25519',
      publicKey: keyPair.public_key,
      revokedAt: null,
      deletedAt: null,
    }),
    ...overrides,
  };
}

test('production graph verifier accepts a real external signature and keeps event hash semantics separate', async () => {
  const keyPair = generateEd25519KeyPair();
  const unsigned = commandFor(null);
  const signedPayload = {
    claimId: unsigned.claimId,
    questionId: unsigned.questionId,
    draftedByActorId: unsigned.draftedByActorId,
    statement: unsigned.statement,
    scope: unsigned.scope,
    assumptions: unsigned.assumptions,
    falsification: unsigned.falsification,
  };
  const envelope = await signedEnvelope({ keyPair, payload: signedPayload });
  const command = commandFor(envelope);
  const verifier = createResearchGraphEventVerifier({ repository: repositoryFor(keyPair) });

  assert.equal(await verifier({ event: eventFor(command), mutationKind: 'claim.create', command }), true);
  assert.notEqual(eventFor(command).hash, envelope.signing_bytes_hash);
});

test('production graph verifier rejects tampering and missing nonce-claim proof', async () => {
  const keyPair = generateEd25519KeyPair();
  const base = commandFor(null);
  const envelope = await signedEnvelope({ keyPair, payload: {
    claimId: base.claimId,
    questionId: base.questionId,
    draftedByActorId: base.draftedByActorId,
    statement: base.statement,
    scope: base.scope,
    assumptions: base.assumptions,
    falsification: base.falsification,
  } });
  const command = commandFor(envelope);
  const verifier = createResearchGraphEventVerifier({ repository: repositoryFor(keyPair) });

  await assert.rejects(
    verifier({ event: eventFor(command, { ...envelope, nonce: 'nonce-tampered-012345' }), mutationKind: 'claim.create', command }),
    (error) => error.code === 'RESEARCH_GRAPH_DUAL_WRITE_EVENT_UNVERIFIED',
  );
  await assert.rejects(
    verifier({ event: eventFor({ ...command, clientSignatureVerified: false }), mutationKind: 'claim.create', command: { ...command, clientSignatureVerified: false } }),
    (error) => error.code === 'RESEARCH_GRAPH_EXTERNAL_SIGNATURE_REQUIRED',
  );
  await assert.rejects(
    verifier({ event: eventFor({ ...command, statement: 'tampered' }), mutationKind: 'claim.create', command: { ...command, statement: 'tampered' } }),
    (error) => error.code === 'RESEARCH_GRAPH_DUAL_WRITE_EVENT_UNVERIFIED',
  );
});
test('production graph verifier fails closed for missing, revoked, or wrong-actor keys', async () => {
  const keyPair = generateEd25519KeyPair();
  const base = commandFor(null);
  const envelope = await signedEnvelope({ keyPair, payload: {
    claimId: base.claimId,
    questionId: base.questionId,
    draftedByActorId: base.draftedByActorId,
    statement: base.statement,
    scope: base.scope,
    assumptions: base.assumptions,
    falsification: base.falsification,
  } });
  const command = commandFor(envelope);
  const invocation = { event: eventFor(command), mutationKind: 'claim.create', command };

  await assert.rejects(
    createResearchGraphEventVerifier({ repository: repositoryFor(keyPair, { findActiveSigningKey: async () => null }) })(invocation),
    (error) => error.code === 'CLIENT_SIGNATURE_KEY_NOT_FOUND',
  );
  await assert.rejects(
    createResearchGraphEventVerifier({ repository: repositoryFor(keyPair, {
      findActiveSigningKey: async () => ({ keyId: 'key-human-1', actorId: 'human-1', algorithm: 'Ed25519', publicKey: keyPair.public_key, revokedAt: '2026-08-31T00:00:00Z' }),
    }) })(invocation),
    (error) => error.code === 'CLIENT_SIGNATURE_ACTOR_MISMATCH',
  );
  await assert.rejects(
    createResearchGraphEventVerifier({ repository: repositoryFor(keyPair, {
      findActiveSigningKey: async () => ({ keyId: 'key-human-1', actorId: 'human-other', algorithm: 'Ed25519', publicKey: keyPair.public_key, revokedAt: null }),
    }) })(invocation),
    (error) => error.code === 'CLIENT_SIGNATURE_ACTOR_MISMATCH',
  );
});
