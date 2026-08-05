import test from "node:test";
import assert from "node:assert/strict";
import { createProject } from "../src/project-command.mjs";

function repositoryFixture() {
  const calls = [];
  const repository = {
    withTransaction: (callback) => callback(repository),
    insertProject: async (value) => { calls.push(["project", value]); return value; },
    insertProjectRevision: async (value) => { calls.push(["revision", value]); return value; },
    insertProjectMember: async (value) => { calls.push(["member", value]); return value; },
    appendResearchEvent: async (value) => { calls.push(["event", value]); return value; },
  };
  return { repository, calls };
}

test("creates the project, first revision, owner membership, and event atomically", async () => {
  const { repository, calls } = repositoryFixture();
  const result = await createProject({
    repository,
    actorId: "actor-1",
    projectId: "project-1",
    name: "Evidence Mesh",
    summary: "A reproducible research project",
    license: "CC-BY-4.0",
    maintainerIds: ["actor-2", "actor-2"],
    eventFactory: async ({ eventType, payload }) => ({ eventId: "event-1", eventType, payload }),
  });

  assert.deepEqual(calls.map(([kind]) => kind), ["project", "revision", "member", "event"]);
  assert.equal(result.project.state, "draft");
  assert.equal(result.revision.revision, 1);
  assert.deepEqual(result.revision.maintainerIds, ["actor-1", "actor-2"]);
  assert.deepEqual(result.member, { projectId: "project-1", actorId: "actor-1", role: "owner" });
  assert.equal(result.event.eventType, "project.created");
  assert.deepEqual(result.event.payload, {
    entity_type: "project",
    project_id: "project-1",
    revision: 1,
    actor_id: "actor-1",
  });
});

test("rejects invalid project input before opening a transaction", async () => {
  const { repository } = repositoryFixture();
  let called = false;
  repository.withTransaction = () => { called = true; };

  await assert.rejects(
    createProject({
      repository,
      actorId: "actor-1",
      projectId: "project-1",
      name: " ",
      summary: "summary",
      license: "CC0-1.0",
      eventFactory: () => ({}),
    }),
    /project name must be a non-empty string/,
  );
  assert.equal(called, false);
});
