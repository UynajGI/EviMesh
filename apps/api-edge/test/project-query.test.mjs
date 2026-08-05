import test from "node:test";
import assert from "node:assert/strict";
import { getProject, listProjects } from "../src/project-query.mjs";

const projects = [
  { projectId: "project-3", state: "draft", createdAt: "2026-08-03T00:00:00.000Z" },
  { projectId: "project-1", state: "draft", createdAt: "2026-08-01T00:00:00.000Z" },
  { projectId: "project-2", state: "active", createdAt: "2026-08-02T00:00:00.000Z" },
];

test("lists projects with stable cursor pagination and state filtering", async () => {
  const first = await listProjects({
    repository: { listProjects: async ({ state }) => projects.filter((project) => !state || project.state === state) },
    state: "draft",
    limit: 1,
  });
  const second = await listProjects({
    repository: { listProjects: async ({ state }) => projects.filter((project) => !state || project.state === state) },
    state: "draft",
    limit: 1,
    cursor: first.nextCursor,
  });

  assert.deepEqual(first.items.map(({ projectId }) => projectId), ["project-1"]);
  assert.deepEqual(second.items.map(({ projectId }) => projectId), ["project-3"]);
  assert.equal(second.nextCursor, null);
});

test("returns a project with its current revision", async () => {
  const result = await getProject({
    repository: {
      getProject: async (projectId) => ({ projectId, state: "draft" }),
      getCurrentProjectRevision: async (projectId) => ({ projectId, revision: 1, name: "Evidence Mesh" }),
    },
    projectId: "project-1",
  });

  assert.equal(result.project.projectId, "project-1");
  assert.equal(result.currentRevision.revision, 1);
});

test("returns a typed not-found error for an unknown project", async () => {
  await assert.rejects(
    getProject({
      repository: {
        getProject: async () => null,
        getCurrentProjectRevision: async () => null,
      },
      projectId: "project-missing",
    }),
    (error) => error.code === "PROJECT_NOT_FOUND" && error.status === 404,
  );
});
