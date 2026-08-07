import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { verifyClientSignatureEnvelope } from "../src/client-signature.mjs";
import { generateEd25519KeyPair } from "../../../packages/signatures/src/ed25519.mjs";
import { signEd25519Payload } from "../../../packages/signatures/src/client-signature.mjs";
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
  return { findActiveSigningKey: async () => ({ keyId, actorId: "actor-1", algorithm: "Ed25519", publicKey: keypair.public_key }) };
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

test("POST /claims accepts a valid signed envelope and rejects a tampered one", async () => {
  const keypair = generateEd25519KeyPair();
  const inserted = [];
  const insertClaim = async (claim) => { inserted.push(claim); return claim; };
  const insertClaimRevision = async (revision) => revision;
  const appendResearchEvent = async (event) => event;
  const repository = {
    findIdentity: async () => ({ actorId: "actor-1" }),
    findActiveSigningKey: async () => ({ keyId: "key-1", actorId: "actor-1", algorithm: "Ed25519", publicKey: keypair.public_key }),
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
