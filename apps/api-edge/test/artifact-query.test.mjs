import test from "node:test";
import assert from "node:assert/strict";
import { ArtifactQueryError, getArtifact, getArtifactRevision, listArtifacts } from "../src/artifact-query.mjs";

const artifacts = [
  { artifactId: "artifact_b", createdAt: "2026-01-02T00:00:00.000Z" },
  { artifactId: "artifact_a", createdAt: "2026-01-01T00:00:00.000Z" },
];

test("lists artifacts with filters and stable pagination", async () => {
  const calls = [];
  const repository = { listArtifacts: async (filters) => { calls.push(filters); return artifacts; } };
  const page = await listArtifacts({ repository, artifactType: "dataset", createdBy: " actor_1 ", limit: 1 });
  assert.deepEqual(calls, [{ artifactType: "dataset", createdBy: "actor_1" }]);
  assert.deepEqual(page.items, [artifacts[1]]);
  assert.ok(page.nextCursor);
});

test("returns current artifact revision and locations", async () => {
  const repository = {
    getArtifact: async (id) => ({ artifactId: id }),
    getCurrentArtifactRevision: async () => ({ artifactId: "artifact_a", revision: 1 }),
    listArtifactLocations: async () => [{ uri: "s3://bucket/key" }],
  };
  assert.deepEqual(await getArtifact({ repository, artifactId: " artifact_a " }), {
    artifact: { artifactId: "artifact_a" },
    currentRevision: { artifactId: "artifact_a", revision: 1 },
    locations: [{ uri: "s3://bucket/key" }],
  });
});

test("returns a revision and rejects missing artifacts", async () => {
  const repository = { getArtifactRevision: async (id, revision) => ({ artifactId: id, revision }) };
  assert.deepEqual(await getArtifactRevision({ repository, artifactId: "artifact_a", revision: 2 }), { artifactId: "artifact_a", revision: 2 });
  await assert.rejects(() => getArtifact({ repository: {}, artifactId: "artifact_a" }), ArtifactQueryError);
  await assert.rejects(() => getArtifactRevision({ repository, artifactId: "artifact_a", revision: 0 }), ArtifactQueryError);
});
