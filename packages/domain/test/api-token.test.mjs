import test from "node:test";
import assert from "node:assert/strict";
import { ApiTokenError, createActorApiToken } from "../src/api-token.mjs";

function createRepository() {
  const records = [];
  return {
    records,
    async withTransaction(callback) { return callback(this); },
    async insertApiToken(record) {
      records.push({ tokenId: "token_1", ...record });
      return records.at(-1);
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
