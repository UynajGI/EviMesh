import test from "node:test";
import assert from "node:assert/strict";
import { listActorSigningKeys, registerActorSigningKey, revokeActorSigningKey, SigningKeyError } from "../src/signing-key.mjs";

const spki = (fill) => Buffer.concat([
  Buffer.from("302a300506032b6570032100", "hex"),
  Buffer.alloc(32, fill),
]).toString("base64url");

function createRepository() {
  const keys = new Map();
  return {
    keys,
    async withTransaction(callback) { return callback(this); },
    async findActiveSigningKey(actorId) {
      return [...this.keys.values()].find((key) => key.actorId === actorId && !key.revokedAt) ?? null;
    },
    async listSigningKeys(actorId) {
      return [...this.keys.values()].filter((key) => key.actorId === actorId);
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
    publicKey: spki(1),
  });

  assert.deepEqual(result, {
    actorId: "actor_1",
    keyId: "key_1",
    algorithm: "Ed25519",
    publicKey: spki(1),
  });
});

test("revokes only an active key owned by the actor", async () => {
  const repository = createRepository();
  await registerActorSigningKey({ repository, actorId: "actor_1", keyId: "key_1", publicKey: spki(1) });
  const revoked = await revokeActorSigningKey({ repository, actorId: "actor_1", keyId: "key_1" });

  assert.equal(revoked.revokedAt, "now");
  await assert.rejects(
    revokeActorSigningKey({ repository, actorId: "actor_2", keyId: "key_1" }),
    (error) => error instanceof SigningKeyError && error.code === "SIGNING_KEY_NOT_FOUND",
  );
});

test("rejects a second active key and unsupported algorithms", async () => {
  const repository = createRepository();
  const input = { repository, actorId: "actor_1", keyId: "key_1", publicKey: spki(1) };
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

test("lists public key history for only the requested actor", async () => {
  const repository = createRepository();
  await registerActorSigningKey({ repository, actorId: "actor_1", keyId: "key_1", publicKey: spki(1) });
  await registerActorSigningKey({ repository, actorId: "actor_2", keyId: "key_2", publicKey: spki(2) });
  assert.deepEqual((await listActorSigningKeys({ repository, actorId: "actor_1" })).map((key) => key.keyId), ["key_1"]);
});

test("rejects non-SPKI, padded, and wrong-prefix public keys", async () => {
  const repository = createRepository();
  for (const publicKey of ["did:key:z6Mktest", `${spki(1)}=`, Buffer.alloc(44, 1).toString("base64url")]) {
    await assert.rejects(
      registerActorSigningKey({ repository, actorId: "actor_1", keyId: "key_bad", publicKey }),
      (error) => error instanceof SigningKeyError && error.code === "SIGNING_KEY_INVALID",
    );
  }
});
