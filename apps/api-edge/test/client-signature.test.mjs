import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { verifyClientSignatureEnvelope } from "../src/client-signature.mjs";
import { generateEd25519KeyPair } from "../../../packages/signatures/src/ed25519.mjs";
import { signEd25519Payload } from "../../../packages/signatures/src/client-signature.mjs";
import { verifyEd25519Payload } from "../../../packages/signatures/src/server-verification.mjs";
import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";

function makeEnvelope({ keypair, keyId, eventType, payload, nonce = "nonce-0123456789abcdef", tamperSign = false } = {}) {
  const signingBytes = Buffer.from(canonicalJson({ event_type: eventType, payload, nonce }), "utf8");
  return signEd25519Payload({ signingBytes: new Uint8Array(signingBytes), privateKey: keypair.private_key }).then((signature) => ({
    schema: "srp.client-signature-envelope.v1",
    event_type: eventType,
    payload,
    nonce,
    signing_bytes_hash: `sha256:${rawHash(signingBytes.toString("utf8"))}`,
    signature: { algorithm: "Ed25519", key_id: keyId, value: tamperSign ? signature.slice(0, -4) + "AAAA" : signature },
  }));
}

function keyRepository(keypair, keyId) {
  return {
    findActiveSigningKey: async () => ({ keyId, actorId: "actor-1", algorithm: "Ed25519", publicKey: keypair.public_key }),
    claimSignatureNonce: async () => true,
  };
}

test("verifies a well-formed envelope against the actor's active signing key", async () => {
  const keypair = generateEd25519KeyPair();
  const payload = { claimId: "claim-1", statement: "s" };
  const envelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload });
  const result = await verifyClientSignatureEnvelope({ repository: keyRepository(keypair, "key-1"), actorId: "actor-1", envelope, payload, expectedEventType: "claim.created" });
  assert.equal(result.verified, true);
  assert.equal(result.keyId, "key-1");
});

test("rejects envelopes whose payload differs from the request", async () => {
  const keypair = generateEd25519KeyPair();
  const envelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload: { claimId: "claim-1", statement: "signed" } });
  await assert.rejects(
    verifyClientSignatureEnvelope({ repository: keyRepository(keypair, "key-1"), actorId: "actor-1", envelope, payload: { claimId: "claim-1", statement: "different" }, expectedEventType: "claim.created" }),
    (error) => error.code === "CLIENT_SIGNATURE_PAYLOAD_MISMATCH",
  );
});

test("rejects envelopes signed by an unknown key or with a bad signature", async () => {
  const keypair = generateEd25519KeyPair();
  const payload = { claimId: "claim-1" };
  const wrongKey = await makeEnvelope({ keypair, keyId: "key-other", eventType: "claim.created", payload });
  await assert.rejects(
    verifyClientSignatureEnvelope({ repository: keyRepository(keypair, "key-1"), actorId: "actor-1", envelope: wrongKey, payload, expectedEventType: "claim.created" }),
    (error) => error.code === "CLIENT_SIGNATURE_KEY_NOT_FOUND",
  );
  const badSignature = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload, tamperSign: true });
  await assert.rejects(
    verifyClientSignatureEnvelope({ repository: keyRepository(keypair, "key-1"), actorId: "actor-1", envelope: badSignature, payload, expectedEventType: "claim.created" }),
    (error) => error.code === "CLIENT_SIGNATURE_MISMATCH",
  );
});

test("rejects event type mismatches and malformed envelopes", async () => {
  const keypair = generateEd25519KeyPair();
  const payload = { claimId: "claim-1" };
  const envelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "run.created", payload });
  await assert.rejects(
    verifyClientSignatureEnvelope({ repository: keyRepository(keypair, "key-1"), actorId: "actor-1", envelope, payload, expectedEventType: "claim.created" }),
    (error) => error.code === "CLIENT_SIGNATURE_EVENT_TYPE_MISMATCH",
  );
  await assert.rejects(
    verifyClientSignatureEnvelope({ repository: keyRepository(keypair, "key-1"), actorId: "actor-1", envelope: null, payload, expectedEventType: "claim.created" }),
    (error) => error.code === "CLIENT_SIGNATURE_INVALID",
  );
});

test("rejects a replay but permits the same nonce for another actor", async () => {
  const keypair = generateEd25519KeyPair();
  const payload = { claimId: "claim-1" };
  const envelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload });
  const claimed = new Set();
  const repository = {
    findActiveSigningKey: async (actorId) => ({ keyId: "key-1", actorId, algorithm: "Ed25519", publicKey: keypair.public_key }),
    claimSignatureNonce: async ({ actorId, keyId, nonce }) => {
      const value = `${actorId}:${keyId}:${nonce}`;
      if (claimed.has(value)) return false;
      claimed.add(value);
      return true;
    },
  };
  await verifyClientSignatureEnvelope({ repository, actorId: "actor-1", envelope, payload, expectedEventType: "claim.created" });
  await assert.rejects(
    verifyClientSignatureEnvelope({ repository, actorId: "actor-1", envelope, payload, expectedEventType: "claim.created" }),
    (error) => error.code === "CLIENT_SIGNATURE_REPLAYED" && error.status === 409,
  );
  await assert.doesNotReject(
    verifyClientSignatureEnvelope({ repository, actorId: "actor-2", envelope, payload, expectedEventType: "claim.created" }),
  );
});

test("verifies the exact sent payload when optional fields are omitted", async () => {
  const keypair = generateEd25519KeyPair();
  const insertedClaims = [];
  const insertedRevisions = [];
  const insertClaim = async (claim) => { insertedClaims.push(claim); return claim; };
  const insertClaimRevision = async (revision) => { insertedRevisions.push(revision); return revision; };
  const appendResearchEvent = async (event) => event;
  const repository = {
    findIdentity: async () => ({ actorId: "actor-1" }),
    getActor: async (actorId) => ({ actorId, actorType: "human" }),
    findActiveSigningKey: async () => ({ keyId: "key-1", actorId: "actor-1", algorithm: "Ed25519", publicKey: keypair.public_key }),
    claimSignatureNonce: async () => true,
    insertClaim,
    insertClaimRevision,
    appendResearchEvent,
    withTransaction: async (callback) => callback({ insertClaim, insertClaimRevision, appendResearchEvent }),
  };
  const app = createApp({
    repository,
    claimEventFactory: async ({ eventType, payload }) => ({ eventType, payload }),
    claimRoleResolver: async () => "maintainer",
    authenticate: async () => ({ sub: "supabase-subject" }),
  });
  // The client signs exactly what it sends: no `assumptions`, no `questionId`.
  const body = { claimId: "claim-1", statement: "minimal", scope: ["s"], falsification: ["f"] };
  const envelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload: body });
  const response = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...body, signatureEnvelope: envelope }),
  }), {});
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal(insertedClaims[0].questionId, null);
  assert.deepEqual(insertedRevisions[0].assumptions, []);
});

test("POST /claims accepts a valid signed envelope and rejects a tampered one", async () => {
  const keypair = generateEd25519KeyPair();
  const inserted = [];
  const insertClaim = async (claim) => { inserted.push(claim); return claim; };
  const insertClaimRevision = async (revision) => revision;
  const appendResearchEvent = async (event) => event;
  const repository = {
    findIdentity: async () => ({ actorId: "actor-1" }),
    getActor: async (actorId) => ({ actorId, actorType: "human" }),
    findActiveSigningKey: async () => ({ keyId: "key-1", actorId: "actor-1", algorithm: "Ed25519", publicKey: keypair.public_key }),
    claimSignatureNonce: async () => true,
    insertClaim,
    insertClaimRevision,
    appendResearchEvent,
    withTransaction: async (callback) => callback({ insertClaim, insertClaimRevision, appendResearchEvent }),
  };
  const app = createApp({
    repository,
    claimEventFactory: async ({ eventType, payload }) => ({ eventType, payload }),
    claimRoleResolver: async () => "maintainer",
    authenticate: async () => ({ sub: "supabase-subject" }),
  });
  const body = { claimId: "claim-1", questionId: null, statement: "signed claim", scope: ["s"], assumptions: [], falsification: ["f"] };
  const envelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload: body });
  const accepted = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...body, signatureEnvelope: envelope }),
  }), {});
  assert.equal(accepted.status, 201);
  assert.equal(inserted[0].claimId, "claim-1");

  const tamperedBody = { ...body, statement: "tampered after signing" };
  const rejected = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...tamperedBody, signatureEnvelope: envelope }),
  }), {});
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).code, "CLIENT_SIGNATURE_PAYLOAD_MISMATCH");
});

test("POST /claims preserves a signed agent drafting attribution and rejects forged or unknown drafters", async () => {
  const keypair = generateEd25519KeyPair();
  const calls = [];
  const actorLookups = [];
  const repository = {
    findIdentity: async () => ({ actorId: "human-1" }),
    findActiveSigningKey: async () => ({ keyId: "key-1", actorId: "human-1", algorithm: "Ed25519", publicKey: keypair.public_key }),
    claimSignatureNonce: async () => true,
    getActor: async (actorId) => {
      actorLookups.push(actorId);
      if (actorId === "human-1") return { actorId, actorType: "human" };
      if (actorId === "agent-1") return { actorId, actorType: "agent" };
      return null;
    },
    insertClaim: async (claim) => { calls.push(["claim", claim]); return claim; },
    insertClaimRevision: async (revision) => { calls.push(["revision", revision]); return revision; },
    appendResearchEvent: async (event) => { calls.push(["event", event]); return event; },
    insertContributionStatement: async (statement) => { calls.push(["contribution", statement]); return statement; },
    insertContributionEdge: async (edge) => { calls.push(["edge", edge]); return edge; },
  };
  repository.withTransaction = async (callback) => callback(repository);
  const app = createApp({
    repository,
    claimEventFactory: async ({ eventType, payload }) => ({ eventId: `event-${calls.length + 1}`, eventType, payload }),
    claimRoleResolver: async () => "maintainer",
    authenticate: async () => ({ sub: "supabase-subject" }),
  });
  const body = { claimId: "claim-agent", draftedByActorId: "agent-1", statement: "agent draft", scope: ["s"], falsification: ["f"] };
  const envelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload: body });
  const submittedEnvelope = {
    ...envelope,
    unsigned_extra: "discard me",
    signature: { ...envelope.signature, key_id: " key-1 ", unsigned_extra: "discard me" },
  };
  const accepted = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...body, signatureEnvelope: submittedEnvelope }),
  }), {});
  assert.equal(accepted.status, 201, await accepted.clone().text());
  const result = await accepted.json();
  assert.equal(result.claim.createdBy, "human-1");
  assert.equal(result.revision.createdBy, "human-1");
  assert.equal(result.contribution.actorId, "agent-1");
  assert.equal(result.contribution.role, "originator");
  const persistedPublisherEnvelope = result.event.payload.publisher_signature_envelope;
  assert.deepEqual(persistedPublisherEnvelope, envelope);
  assert.deepEqual(persistedPublisherEnvelope.payload, body);
  assert.equal(persistedPublisherEnvelope.nonce, envelope.nonce);
  assert.equal(persistedPublisherEnvelope.signing_bytes_hash, envelope.signing_bytes_hash);
  assert.equal(persistedPublisherEnvelope.signature.key_id, "key-1");
  assert.equal(persistedPublisherEnvelope.signature.value, envelope.signature.value);
  assert.equal(persistedPublisherEnvelope.unsigned_extra, undefined);
  assert.equal(persistedPublisherEnvelope.signature.unsigned_extra, undefined);
  assert.equal(await verifyEd25519Payload({
    signingBytes: new TextEncoder().encode(canonicalJson({
      event_type: persistedPublisherEnvelope.event_type,
      payload: persistedPublisherEnvelope.payload,
      nonce: persistedPublisherEnvelope.nonce,
    })),
    signature: persistedPublisherEnvelope.signature.value,
    publicKey: keypair.public_key,
  }), true);
  assert.deepEqual(calls.map(([kind]) => kind), ["claim", "revision", "event", "contribution", "edge"]);
  assert.deepEqual(actorLookups, ["human-1", "agent-1"]);

  const forged = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...body, draftedByActorId: "agent-forged", signatureEnvelope: envelope }),
  }), {});
  assert.equal(forged.status, 404);
  assert.equal((await forged.json()).code, "CLAIM_DRAFTER_NOT_FOUND");

  const unknownBody = { ...body, claimId: "claim-unknown", draftedByActorId: "agent-missing" };
  const unknownEnvelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload: unknownBody, nonce: "nonce-unknown-agent-0001" });
  const unknown = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...unknownBody, signatureEnvelope: unknownEnvelope }),
  }), {});
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).code, "CLAIM_DRAFTER_NOT_FOUND");

  const unsigned = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...body, claimId: "claim-unsigned" }),
  }), {});
  assert.equal(unsigned.status, 400);
  assert.equal((await unsigned.json()).code, "CLAIM_DRAFTER_SIGNATURE_REQUIRED");
});

test("POST /claims rejects a machine or missing publisher for another agent's draft", async () => {
  const keypair = generateEd25519KeyPair();
  const body = { claimId: "claim-agent", draftedByActorId: "agent-drafter", statement: "agent draft", scope: ["s"], falsification: ["f"] };
  const envelope = await makeEnvelope({ keypair, keyId: "key-1", eventType: "claim.created", payload: body });
  const writes = [];
  const request = () => new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...body, signatureEnvelope: envelope }),
  });
  const appForPublisher = (publisherActor) => {
    const repository = {
      findIdentity: async () => ({ actorId: "publisher-1" }),
      findActiveSigningKey: async () => ({ keyId: "key-1", actorId: "publisher-1", algorithm: "Ed25519", publicKey: keypair.public_key }),
      claimSignatureNonce: async () => true,
      getActor: async (actorId) => actorId === "publisher-1" ? publisherActor : { actorId, actorType: "agent" },
      insertClaim: async (claim) => { writes.push(claim); return claim; },
      insertClaimRevision: async (revision) => revision,
      appendResearchEvent: async (event) => event,
      insertContributionStatement: async (statement) => statement,
      insertContributionEdge: async (edge) => edge,
    };
    repository.withTransaction = async (callback) => callback(repository);
    return createApp({
      repository,
      claimEventFactory: async ({ eventType, payload }) => ({ eventId: "event-1", eventType, payload }),
      claimRoleResolver: async () => "maintainer",
      authenticate: async () => ({ sub: "supabase-subject" }),
    });
  };

  for (const [publisherActor, code] of [
    [{ actorId: "publisher-1", actorType: "agent" }, "CLAIM_PUBLISHER_TYPE_INVALID"],
    [{ actorId: "publisher-1", actorType: "service" }, "CLAIM_PUBLISHER_TYPE_INVALID"],
    [null, "CLAIM_PUBLISHER_NOT_FOUND"],
  ]) {
    const response = await appForPublisher(publisherActor).fetch(request(), {});
    assert.equal(response.status, code === "CLAIM_PUBLISHER_NOT_FOUND" ? 404 : 403);
    assert.equal((await response.json()).code, code);
  }
  assert.equal(writes.length, 0);
});

test("POST /claims rejects an agent or service publisher even when draftedByActorId is omitted or self", async () => {
  const writes = [];
  for (const actorType of ["agent", "service"]) {
    for (const draftedByActorId of [undefined, "publisher-1"]) {
      const repository = {
        findIdentity: async () => ({ actorId: "publisher-1" }),
        getActor: async () => ({ actorId: "publisher-1", actorType }),
        insertClaim: async (claim) => { writes.push(claim); return claim; },
        withTransaction: async (callback) => callback(repository),
      };
      const app = createApp({
        repository,
        claimEventFactory: async ({ eventType, payload }) => ({ eventType, payload }),
        claimRoleResolver: async () => "maintainer",
        authenticate: async () => ({ sub: "supabase-subject" }),
      });
      const body = { claimId: `claim-${actorType}-${draftedByActorId ? "self" : "default"}`, statement: "machine publish", scope: ["s"], falsification: ["f"] };
      if (draftedByActorId) body.draftedByActorId = draftedByActorId;
      const response = await app.fetch(new Request("https://api.example.test/claims", {
        method: "POST",
        headers: { authorization: "Bearer test-token", "content-type": "application/json" },
        body: JSON.stringify(body),
      }), {});
      assert.equal(response.status, 403, `${actorType}:${draftedByActorId ?? "omitted"}`);
      assert.equal((await response.json()).code, "CLAIM_PUBLISHER_TYPE_INVALID");
    }
  }
  assert.equal(writes.length, 0);
});

test('signed routes use the injected persistent nonce store, reject a duplicate, and permit another actor', async () => {
  const keypair = generateEd25519KeyPair();
  const claimed = new Set();
  const repository = {
    findIdentity: async (_provider, subject) => ({ actorId: subject }),
    getActor: async (actorId) => ({ actorId, actorType: 'human' }),
    findActiveSigningKey: async (actorId) => ({ keyId: 'key-1', actorId, algorithm: 'Ed25519', publicKey: keypair.public_key }),
    insertClaim: async (claim) => claim,
    insertClaimRevision: async (revision) => revision,
    appendResearchEvent: async (event) => event,
    withTransaction: async (callback) => callback(repository),
  };
  const signatureNonceStore = {
    claimSignatureNonce: async ({ actorId, keyId, nonce }) => {
      const value = `${actorId}:${keyId}:${nonce}`;
      if (claimed.has(value)) return false;
      claimed.add(value);
      return true;
    },
  };
  const app = createApp({
    repository,
    signatureNonceStore,
    claimEventFactory: async ({ eventType, payload }) => ({ eventType, payload }),
    claimRoleResolver: async () => 'maintainer',
    authenticate: async (request) => ({ sub: request.headers.get('x-actor') }),
  });
  const body = { claimId: 'claim-1', statement: 'signed claim', scope: ['s'], falsification: ['f'] };
  const envelope = await makeEnvelope({ keypair, keyId: 'key-1', eventType: 'claim.created', payload: body });
  const requestFor = (actor) => new Request('https://api.example.test/claims', {
    method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', 'x-actor': actor }, body: JSON.stringify({ ...body, signatureEnvelope: envelope }),
  });
  assert.equal((await app.fetch(requestFor('actor-1'), {})).status, 201);
  const replay = await app.fetch(requestFor('actor-1'), {});
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).code, 'CLIENT_SIGNATURE_REPLAYED');
  assert.equal((await app.fetch(requestFor('actor-2'), {})).status, 201);
});

test('signed routes fail closed when no repository nonce method or Supabase configuration exists', async () => {
  const keypair = generateEd25519KeyPair();
  const repository = {
    findIdentity: async () => ({ actorId: 'actor-1' }),
    getActor: async (actorId) => ({ actorId, actorType: 'human' }),
    findActiveSigningKey: async () => ({ keyId: 'key-1', actorId: 'actor-1', algorithm: 'Ed25519', publicKey: keypair.public_key }),
    insertClaim: async (claim) => claim,
    insertClaimRevision: async (revision) => revision,
    appendResearchEvent: async (event) => event,
    withTransaction: async (callback) => callback(repository),
  };
  const app = createApp({ repository, claimEventFactory: async ({ eventType, payload }) => ({ eventType, payload }), claimRoleResolver: async () => 'maintainer', authenticate: async () => ({ sub: 'subject-1' }) });
  const body = { claimId: 'claim-1', statement: 'signed claim', scope: ['s'], falsification: ['f'] };
  const envelope = await makeEnvelope({ keypair, keyId: 'key-1', eventType: 'claim.created', payload: body });
  const response = await app.fetch(new Request('https://api.example.test/claims', { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify({ ...body, signatureEnvelope: envelope }) }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'CLIENT_SIGNATURE_UNAVAILABLE');
});
