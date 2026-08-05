import test from "node:test";
import assert from "node:assert/strict";
import { registerActorSigningKey, revokeActorSigningKey, SigningKeyError } from "../src/signing-key.mjs";

function createRepository() {
  const keys = new Map();
  return {
    keys,
    async withTransaction(callback) { return callback(this); },
    async findActiveSigningKey(actorId) {
      return [...this.keys.values()].find((key) => key.actorId === actorId && !key.revokedAt) ?? null;
    },
    async insertSigningKey(key) { this.keys.set(key.keyId, key); },
    async revokeSigningKey(actorId, keyId) {
      const key = this.keys.get(keyId);
      if (!key || key.actorId !== actorId || key.revokedAt) return null;
      const revoked = { ...key, revokedAt: "now" };
      this.keys.set(keyId, revoked);
      return revoked;
    },
  };
}

test("registers one active Ed25519 key for an actor", async () => {
  const repository = createRepository();
  const result = await registerActorSigningKey({
    repository,
    actorId: "actor_1",
    keyId: "key_1",
    publicKey: "did:key:z6Mktest",
  });

  assert.deepEqual(result, {
    actorId: "actor_1",
    keyId: "key_1",
    algorithm: "Ed25519",
    publicKey: "did:key:z6Mktest",
  });
});

test("revokes only an active key owned by the actor", async () => {
  const repository = createRepository();
  await registerActorSigningKey({ repository, actorId: "actor_1", keyId: "key_1", publicKey: "did:key:z6Mktest" });
  const revoked = await revokeActorSigningKey({ repository, actorId: "actor_1", keyId: "key_1" });

  assert.equal(revoked.revokedAt, "now");
  await assert.rejects(
    revokeActorSigningKey({ repository, actorId: "actor_2", keyId: "key_1" }),
    (error) => error instanceof SigningKeyError && error.code === "SIGNING_KEY_NOT_FOUND",
  );
});

test("rejects a second active key and unsupported algorithms", async () => {
  const repository = createRepository();
  const input = { repository, actorId: "actor_1", keyId: "key_1", publicKey: "did:key:z6Mktest" };
  await registerActorSigningKey(input);
  await assert.rejects(
    registerActorSigningKey({ ...input, keyId: "key_2" }),
    (error) => error instanceof SigningKeyError && error.code === "SIGNING_KEY_ALREADY_ACTIVE",
  );
  await assert.rejects(
    registerActorSigningKey({ ...input, actorId: "actor_2", algorithm: "RSA" }),
    /only Ed25519/,
  );
});
