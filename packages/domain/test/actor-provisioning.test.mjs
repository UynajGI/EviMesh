import test from "node:test";
import assert from "node:assert/strict";
import { ensureActorForIdentity } from "../src/actor-provisioning.mjs";

function createRepository() {
  const actors = new Map();
  const identities = new Map();
  return {
    actors,
    identities,
    async withTransaction(callback) {
      return callback(this);
    },
    async findIdentity(provider, subject) {
      return this.identities.get(`${provider}:${subject}`) ?? null;
    },
    async insertActor(actor) {
      this.actors.set(actor.actorId, actor);
    },
    async insertIdentity(identity) {
      const key = `${identity.provider}:${identity.subject}`;
      if (this.identities.has(key)) throw new Error("identity already exists");
      this.identities.set(key, { ...identity, actor: this.actors.get(identity.actorId) });
    },
  };
}

test("first login creates a human actor and provider identity", async () => {
  const repository = createRepository();
  const result = await ensureActorForIdentity({
    repository,
    provider: "email",
    subject: "supabase-user-01",
    email: "researcher@example.test",
    actorIdFactory: () => "actor_00000000-0000-7000-8000-000000000001",
  });

  assert.equal(result.created, true);
  assert.deepEqual(result.actor, {
    actorId: "actor_00000000-0000-7000-8000-000000000001",
    actorType: "human",
    identityStrength: "verified",
  });
  assert.equal(result.identity.actorId, result.actor.actorId);
  assert.equal(repository.actors.size, 1);
  assert.equal(repository.identities.size, 1);
});

test("repeat login reuses the existing actor", async () => {
  const repository = createRepository();
  const input = {
    repository,
    provider: "email",
    subject: "supabase-user-01",
    email: "researcher@example.test",
    actorIdFactory: () => "actor_00000000-0000-7000-8000-000000000001",
  };
  const first = await ensureActorForIdentity(input);
  const second = await ensureActorForIdentity({ ...input, actorIdFactory: () => "actor_should_not_be_used" });

  assert.equal(second.created, false);
  assert.equal(second.actor.actorId, first.actor.actorId);
  assert.equal(repository.actors.size, 1);
  assert.equal(repository.identities.size, 1);
});

test("rejects missing identity fields before opening a transaction", async () => {
  let transactions = 0;
  await assert.rejects(
    ensureActorForIdentity({
      repository: { withTransaction: async (callback) => { transactions += 1; return callback({}); } },
      provider: "email",
      subject: "",
    }),
    /subject must be a non-empty string/,
  );
  assert.equal(transactions, 0);
});
