import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { getTypedResearchNode, listTypedResearchNodes, TypedResearchQueryError } from "../src/typed-research-query.mjs";

const createdAt = "2026-08-30T00:00:00.000Z";

test("shared typed reader paginates strong entity projections", async () => {
  const seen = [];
  const repository = { listAnswers: async (filters) => { seen.push(filters); return [{ answerId: "answer-1", createdAt }]; } };
  const page = await listTypedResearchNodes({ repository, kind: "answer", projectId: "project-1", state: "published", limit: 5 });
  assert.deepEqual(page.items.map((item) => item.answerId), ["answer-1"]);
  assert.deepEqual(seen[0], { projectId: "project-1", state: "published", stance: null, toolKind: null, accessToken: null, actorId: null });
});

test("shared typed detail includes immutable evaluation bases", async () => {
  const repository = {
    getEvaluation: async (evaluationId) => ({ evaluationId, createdAt }),
    getCurrentEvaluationRevision: async (evaluationId) => ({ evaluationId, revision: 2, stance: "supports" }),
    listEvaluationBases: async (evaluationId, revision) => [{ evaluationId, evaluationRevision: revision, basisKind: "evidence", basisId: "evidence-1", basisRevision: 1 }],
  };
  const detail = await getTypedResearchNode({ repository, kind: "evaluation", id: "evaluation-1" });
  assert.equal(detail.currentRevision.revision, 2);
  assert.deepEqual(detail.bases[0], { kind: "evidence", id: "evidence-1", revision: 1 });
});

test("shared typed reader rejects unavailable capabilities", async () => {
  await assert.rejects(() => listTypedResearchNodes({ repository: {}, kind: "tool" }), (error) => error instanceof TypedResearchQueryError && error.code === "TYPED_RESEARCH_UNAVAILABLE");
});

test("public typed list/detail routes share the reader contract", async () => {
  const repository = {
    listTools: async ({ toolKind }) => [{ toolId: "tool-1", toolKind, createdAt }],
    getTool: async (toolId) => ({ toolId, createdAt, createdBy: "actor-1" }),
    getCurrentToolRevision: async (toolId) => ({ toolId, revision: 3, name: "Reproducer", toolKind: "skill" }),
  };
  const app = createApp({ repository });
  const list = await app.fetch(new Request("https://api.example.test/tools?toolKind=skill&limit=5"), {});
  assert.equal(list.status, 200, await list.clone().text());
  assert.equal((await list.json()).items[0].toolKind, "skill");
  const detail = await app.fetch(new Request("https://api.example.test/tools/tool-1"), {});
  assert.equal(detail.status, 200, await detail.clone().text());
  assert.equal((await detail.json()).currentRevision.revision, 3);
});
