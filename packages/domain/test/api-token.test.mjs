import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiTokenError,
  assertApiTokenScopes,
  createActorApiToken,
  markApiTokenUsed,
  revokeActorApiToken,
} from "../src/api-token.mjs";

function createRepository() {
  const records = [];
  return {
    records,
    async withTransaction(callback) { return callback(this); },
    async insertApiToken(record) {
      records.push({ tokenId: "token_1", ...record });
      return records.at(-1);
    },
    async revokeApiToken(actorId, tokenId) {
      const record = records.find((candidate) => candidate.tokenId === tokenId && candidate.actorId === actorId);
      if (!record || record.revokedAt) return null;
      record.revokedAt = "now";
      return record;
    },
    async updateApiTokenLastUsedAt(tokenId, usedAt) {
      const record = records.find((candidate) => candidate.tokenId === tokenId);
      if (!record) return null;
      record.lastUsedAt = usedAt;
      return record;
    },
  };
}

test("returns plaintext once while persisting only the digest", async () => {
  const repository = createRepository();
  const result = await createActorApiToken({
    repository,
    actorId: "actor_1",
    scopes: ["project:read", "project:read", "profile:write"],
    tokenFactory: () => "evimesh_test_plaintext_token",
    digestFactory: () => "digest_only",
  });

  assert.equal(result.token, "evimesh_test_plaintext_token");
  assert.deepEqual(repository.records, [{
    tokenId: "token_1",
    actorId: "actor_1",
    tokenHash: "digest_only",
    tokenPrefix: "evimesh_test_pla",
    scopes: ["profile:write", "project:read"],
    expiresAt: null,
  }]);
  assert.equal(JSON.stringify(repository.records).includes(result.token), false);
});

test("validates ownership input, scopes, and token factory output", async () => {
  const repository = createRepository();
  await assert.rejects(
    createActorApiToken({ repository, actorId: "actor_1", scopes: ["", "project:read"] }),
    (error) => error instanceof ApiTokenError,
  );
  await assert.rejects(
    createActorApiToken({ repository, actorId: "actor_1", tokenFactory: () => "short" }),
    (error) => error instanceof ApiTokenError,
  );
});

test("requires every requested scope", () => {
  assert.equal(assertApiTokenScopes({ grantedScopes: ["project:read", "profile:write"], requiredScopes: ["project:read"] }), true);
  assert.throws(
    () => assertApiTokenScopes({ grantedScopes: ["project:read"], requiredScopes: ["project:write"] }),
    (error) => error instanceof ApiTokenError && error.code === "API_TOKEN_SCOPE_FORBIDDEN",
  );
});

test("revokes only an owned token and records successful use", async () => {
  const repository = createRepository();
  await createActorApiToken({
    repository,
    actorId: "actor_1",
    tokenFactory: () => "evimesh_test_plaintext_token",
    digestFactory: () => "digest_only",
  });
  const usedAt = new Date("2026-08-06T00:00:00.000Z");
  const used = await markApiTokenUsed({ repository, tokenId: "token_1", usedAt });
  assert.equal(used.lastUsedAt, usedAt);
  const revoked = await revokeActorApiToken({ repository, actorId: "actor_1", tokenId: "token_1" });
  assert.equal(revoked.revokedAt, "now");
  await assert.rejects(
    revokeActorApiToken({ repository, actorId: "actor_2", tokenId: "token_1" }),
    (error) => error instanceof ApiTokenError && error.code === "API_TOKEN_NOT_FOUND",
  );
});
