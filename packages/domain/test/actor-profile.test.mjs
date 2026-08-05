import test from "node:test";
import assert from "node:assert/strict";
import { ActorProfileError, updateOwnActorProfile } from "../src/actor-profile.mjs";

function createRepository() {
  const profiles = new Map([["actor_1", { actorId: "actor_1", displayName: "Old", bio: null, avatarUrl: null }]]);
  return {
    profiles,
    async withTransaction(callback) { return callback(this); },
    async updateActorProfile(actorId, patch) {
      const current = this.profiles.get(actorId);
      if (!current) return null;
      const updated = { ...current, ...patch };
      this.profiles.set(actorId, updated);
      return updated;
    },
  };
}

test("updates only the authenticated actor's profile fields", async () => {
  const repository = createRepository();
  const result = await updateOwnActorProfile({
    repository,
    actorId: "actor_1",
    patch: { displayName: "New name", bio: "Researcher" },
  });

  assert.deepEqual(result, {
    actorId: "actor_1",
    displayName: "New name",
    bio: "Researcher",
    avatarUrl: null,
  });
});

test("rejects unknown fields and missing profiles", async () => {
  const repository = createRepository();
  await assert.rejects(
    updateOwnActorProfile({ repository, actorId: "actor_1", patch: { actorId: "other" } }),
    (error) => error instanceof ActorProfileError && error.code === "ACTOR_PROFILE_INVALID",
  );
  await assert.rejects(
    updateOwnActorProfile({ repository, actorId: "actor_2", patch: { bio: "No profile" } }),
    (error) => error instanceof ActorProfileError && error.code === "ACTOR_PROFILE_NOT_FOUND",
  );
});
