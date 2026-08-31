import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { getResearchNeighborhood, ResearchGraphQueryError } from "../src/research-graph-query.mjs";

const root = { kind: "question", id: "question-1", revision: 2 };
const answer = { kind: "answer", id: "answer-1", revision: 1 };

function repository(result = {}) {
  const calls = [];
  return {
    calls,
    findIdentity: async () => ({ actorId: "actor-1" }),
    getResearchNeighborhood: async (query) => {
      calls.push(query);
      return {
        resolvedRoot: root,
        nodes: [
          { ref: root, label: "Can the method reproduce?", family: "structure", state: "published", isCurrent: true },
          { ref: answer, label: "Reproduction synthesis", family: "reasoning", state: "draft", isCurrent: true },
        ],
        edges: [{ id: "edge-1", type: "answers", family: "reasoning", source: root, target: answer, forwardLabel: "answered by", reverseLabel: "answers" }],
        graphWatermark: "rank:42",
        permissionPartial: false,
        ...result,
      };
    },
  };
}

test("normalizes one bounded heterogeneous research neighborhood", async () => {
  const store = repository();
  const value = await getResearchNeighborhood({ repository: store, kind: "QUESTION", id: "question-1", revision: "2", direction: "both", depth: "2", nodeKinds: ["question", "answer"], edgeTypes: ["answers"] });
  assert.equal(value.schemaVersion, "research-neighborhood.v1");
  assert.deepEqual(value.requestedRoot, root);
  assert.deepEqual(value.resolvedRoot, root);
  assert.deepEqual(value.nodes.map((node) => node.ref.kind), ["question", "answer"]);
  assert.equal(value.edges[0].type, "answers");
  assert.equal(value.graphWatermark, "rank:42");
  assert.deepEqual(store.calls[0], {
    root,
    direction: "both",
    depth: 2,
    nodeKinds: ["question", "answer"],
    edgeTypes: ["answers"],
    cursor: null,
    nodeLimit: 200,
    edgeLimit: 400,
    accessToken: null,
    actorId: null,
  });
});

test("filters hidden relation families without leaving dangling edges", async () => {
  const hidden = { kind: "tool", id: "tool-hidden", revision: 1 };
  const store = repository({
    nodes: [
      { ref: root, label: "Question" },
      { ref: answer, label: "Answer" },
      { ref: hidden, label: "Hidden tool" },
    ],
    edges: [
      { type: "answers", source: root, target: answer },
      { type: "uses_tool", source: hidden, target: answer },
    ],
  });
  const value = await getResearchNeighborhood({ repository: store, kind: "question", id: "question-1", revision: 2, nodeKinds: ["question", "answer"], edgeTypes: ["answers"] });
  assert.deepEqual(value.nodes.map((node) => node.ref.kind), ["question", "answer"]);
  assert.deepEqual(value.edges.map((edge) => edge.type), ["answers"]);
});

test("pins an omitted requested revision and never assumes permission completeness", async () => {
  const value = await getResearchNeighborhood({ repository: repository({ permissionPartial: undefined }), kind: "question", id: "question-1" });
  assert.deepEqual(value.requestedRoot, root);
  assert.equal(value.permissionPartial, true);
});

test("rejects unbounded depth and unavailable repositories", async () => {
  await assert.rejects(() => getResearchNeighborhood({ repository: repository(), kind: "question", id: "question-1", depth: 4 }), (error) => error instanceof ResearchGraphQueryError && error.code === "RESEARCH_GRAPH_QUERY_INVALID");
  await assert.rejects(() => getResearchNeighborhood({ repository: {}, kind: "question", id: "question-1" }), (error) => error instanceof ResearchGraphQueryError && error.code === "RESEARCH_GRAPH_UNAVAILABLE" && error.status === 503);
});

test("serves the public neighborhood route with stable filters", async () => {
  const store = repository();
  const app = createApp({ repository: store, authenticate: async () => ({ sub: "subject-1" }) });
  const response = await app.fetch(new Request("https://api.example.test/research-graph/question/question-1/neighborhood?revision=2&direction=downstream&depth=3&kinds=question,answer&edgeTypes=answers&cursor=next", { headers: { authorization: "Bearer jwt-1" } }), {});
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json();
  assert.equal(body.schemaVersion, "research-neighborhood.v1");
  assert.equal(body.nodes.length, 2);
  assert.deepEqual(store.calls[0], {
    root,
    direction: "downstream",
    depth: 3,
    nodeKinds: ["question", "answer"],
    edgeTypes: ["answers"],
    cursor: "next",
    nodeLimit: 200,
    edgeLimit: 400,
    accessToken: "jwt-1",
    actorId: "actor-1",
  });
});

test("route reports invalid kind and depth without invoking the repository", async () => {
  const store = repository();
  const app = createApp({ repository: store, authenticate: async () => ({ sub: "subject-1" }) });
  const headers = { authorization: "Bearer jwt-1" };
  const invalidKind = await app.fetch(new Request("https://api.example.test/research-graph/actor/actor-1/neighborhood", { headers }), {});
  assert.equal(invalidKind.status, 400);
  assert.equal((await invalidKind.json()).code, "RESEARCH_NODE_KIND_INVALID");
  const invalidDepth = await app.fetch(new Request("https://api.example.test/research-graph/question/question-1/neighborhood?depth=32", { headers }), {});
  assert.equal(invalidDepth.status, 400);
  assert.equal(store.calls.length, 0);
});

test("neighborhood route keeps active research public while marking anonymous topology unknown", async () => {
  const store = repository();
  const app = createApp({ repository: store });
  const response = await app.fetch(new Request("https://api.example.test/research-graph/question/question-1/neighborhood"), {});
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).permissionPartial, true);
  assert.equal(store.calls.length, 1);
  assert.equal(store.calls[0].accessToken, null);
  assert.equal(store.calls[0].actorId, null);
});
