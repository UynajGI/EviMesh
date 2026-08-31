import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseReadRepository } from "../src/supabase-read-repository.mjs";

test("reads heterogeneous neighborhoods only through the public security-invoker views", async () => {
  const paths = [];
  const authorizations = [];
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url, init = {}) => {
      const endpoint = new URL(url);
      paths.push(endpoint.pathname);
      authorizations.push(init.headers?.authorization ?? null);
      if (endpoint.pathname.endsWith("/research_graph_edges")) return Response.json([{
        edge_id: "edge-1", edge_type: "answers",
        source_kind: "question", source_id: "question-1", source_revision: 2,
        target_kind: "answer", target_id: "answer-1", target_revision: 1,
        provenance_event_id: "event-1", created_by: "human-1", created_at: "2026-08-30T00:00:00.000Z",
      }]);
      if (endpoint.pathname.endsWith("/research_graph_nodes") && endpoint.searchParams.get("node_id")?.startsWith("in.(")) return Response.json([
        { node_kind: "question", node_id: "question-1", revision: 2, project_id: "project-1", label: "Question", state: "published", canonical_href: "/questions/question-1", created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1", commit_rank: 2, batch_rank: 1, is_current: true },
        { node_kind: "answer", node_id: "answer-1", revision: 1, project_id: "project-1", label: "Answer", state: "published", canonical_href: "/answers/answer-1", created_at: "2026-08-30T01:00:00.000Z", created_by: "human-1", commit_rank: 3, batch_rank: 1, is_current: true },
      ]);
      if (endpoint.pathname.endsWith("/research_graph_nodes")) return Response.json([
        { node_kind: "question", node_id: "question-1", revision: 2, project_id: "project-1", label: "Question", state: "published", canonical_href: "/questions/question-1", created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1", commit_rank: 2, batch_rank: 1, is_current: true },
      ]);
      return Response.json([]);
    },
  });
  const graph = await repository.getResearchNeighborhood({ root: { kind: "question", id: "question-1", revision: 2 }, direction: "downstream", depth: 1, nodeKinds: [], edgeTypes: ["answers"], nodeLimit: 200, edgeLimit: 400, accessToken: "caller-jwt", actorId: "human-1" });
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges[0].type, "answers");
  assert.equal(graph.edges[0].forwardLabel, "answered by");
  assert.equal(graph.graphWatermark, "2:1");
  assert.equal(graph.permissionPartial, true, "without a privileged comparison the adapter must not claim complete topology");
  assert.ok(paths.every((path) => !path.includes("private")));
  assert.ok(paths.includes("/rest/v1/research_graph_nodes"));
  assert.ok(paths.includes("/rest/v1/research_graph_edges"));
  assert.ok(authorizations.every((value) => value === "Bearer caller-jwt"));
});

test("permission audit drops hidden nodes and incident edges without exposing their count", async () => {
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    serviceRoleKey: "server-secret",
    fetchImpl: async (url, init = {}) => {
      const endpoint = new URL(url);
      const service = init.headers?.authorization === "Bearer server-secret";
      if (endpoint.pathname.endsWith("/research_graph_edges")) {
        const visible = [{
          edge_id: "edge-visible", edge_type: "answers",
          source_kind: "question", source_id: "question-1", source_revision: 1,
          target_kind: "answer", target_id: "answer-1", target_revision: 1,
          provenance_event_id: "event-visible", created_by: "human-1", created_at: "2026-08-30T00:00:00.000Z",
        }];
        return Response.json(service ? [...visible, {
          edge_id: "edge-hidden", edge_type: "extends_question",
          source_kind: "question", source_id: "question-1", source_revision: 1,
          target_kind: "question", target_id: "secret-question", target_revision: 1,
          provenance_event_id: "event-hidden", created_by: "human-2", created_at: "2026-08-30T00:01:00.000Z",
        }] : visible);
      }
      if (endpoint.pathname.endsWith("/research_graph_nodes") && endpoint.searchParams.get("node_id")?.startsWith("in.(")) return Response.json([
        { node_kind: "question", node_id: "question-1", revision: 1, project_id: "project-1", label: "Visible question", state: "published", canonical_href: "/questions/question-1", created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1", commit_rank: 1, batch_rank: 1, is_current: true },
        { node_kind: "answer", node_id: "answer-1", revision: 1, project_id: "project-1", label: "Visible answer", state: "published", canonical_href: "/answers/answer-1", created_at: "2026-08-30T00:02:00.000Z", created_by: "human-1", commit_rank: 2, batch_rank: 1, is_current: true },
      ]);
      if (endpoint.pathname.endsWith("/research_graph_nodes")) return Response.json([
        { node_kind: "question", node_id: "question-1", revision: 1, project_id: "project-1", label: "Visible question", state: "published", canonical_href: "/questions/question-1", created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1", commit_rank: 1, batch_rank: 1, is_current: true },
      ]);
      return Response.json([]);
    },
  });
  const graph = await repository.getResearchNeighborhood({ root: { kind: "question", id: "question-1", revision: 1 }, direction: "downstream", depth: 1, nodeKinds: [], edgeTypes: [], accessToken: "caller-jwt", actorId: "human-1" });
  assert.equal(graph.permissionPartial, true);
  assert.deepEqual(graph.nodes.map((node) => node.ref.id), ["question-1", "answer-1"]);
  assert.deepEqual(graph.edges.map((edge) => edge.id), ["edge-visible"]);
  assert.doesNotMatch(JSON.stringify(graph), /secret-question|edge-hidden|event-hidden/);
});

test("API-token bridge preserves public projects while adding member-private visibility", async () => {
  const rowsById = new Map([
    ["question-public", { node_kind: "question", node_id: "question-public", revision: 1, project_id: "project-public", label: "Public question", state: "published", canonical_href: "/questions/question-public", created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1", commit_rank: 1, batch_rank: 1, is_current: true }],
    ["question-member", { node_kind: "question", node_id: "question-member", revision: 1, project_id: "project-member", label: "Member question", state: "draft", canonical_href: "/questions/question-member", created_at: "2026-08-30T00:01:00.000Z", created_by: "human-1", commit_rank: 2, batch_rank: 1, is_current: true }],
    ["question-secret", { node_kind: "question", node_id: "question-secret", revision: 1, project_id: "project-secret", label: "Secret question", state: "draft", canonical_href: "/questions/question-secret", created_at: "2026-08-30T00:02:00.000Z", created_by: "human-2", commit_rank: 3, batch_rank: 1, is_current: true }],
  ]);
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    serviceRoleKey: "server-secret",
    fetchImpl: async (url, init = {}) => {
      assert.equal(init.headers?.authorization, "Bearer server-secret");
      const endpoint = new URL(url);
      if (endpoint.pathname.endsWith("/project_members")) {
        assert.equal(endpoint.searchParams.get("actor_id"), "eq.agent-1");
        return Response.json([{ project_id: "project-member", actor_id: "agent-1", role: "contributor" }]);
      }
      if (endpoint.pathname.endsWith("/projects")) {
        assert.equal(endpoint.searchParams.get("state"), "eq.active");
        return Response.json([{ project_id: "project-public", state: "active" }]);
      }
      if (endpoint.pathname.endsWith("/research_graph_edges")) return Response.json([]);
      if (endpoint.pathname.endsWith("/research_graph_nodes") && endpoint.searchParams.get("order")?.startsWith("commit_rank.desc")) {
        assert.match(endpoint.searchParams.get("project_id"), /project-member/);
        assert.match(endpoint.searchParams.get("project_id"), /project-public/);
        assert.doesNotMatch(endpoint.searchParams.get("project_id"), /project-secret/);
        return Response.json([rowsById.get("question-member")]);
      }
      if (endpoint.pathname.endsWith("/research_graph_nodes")) {
        const requestedId = endpoint.searchParams.get("node_id")?.replace(/^eq\./, "");
        return Response.json(rowsById.has(requestedId) ? [rowsById.get(requestedId)] : []);
      }
      return Response.json([]);
    },
  });
  const read = (id) => repository.getResearchNeighborhood({
    root: { kind: "question", id, revision: 1 },
    direction: "both",
    depth: 1,
    nodeKinds: [],
    edgeTypes: [],
    accessToken: "evimesh_test-token",
    actorId: "agent-1",
  });

  assert.equal((await read("question-public")).resolvedRoot.id, "question-public");
  assert.equal((await read("question-member")).resolvedRoot.id, "question-member");
  assert.equal(await read("question-secret"), null);
});

test("opaque neighborhood cursor resumes a bounded visible traversal at one watermark", async () => {
  const rootRow = { node_kind: "question", node_id: "question-1", revision: 1, project_id: "project-1", label: "Question", state: "published", canonical_href: "/questions/question-1", created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1", commit_rank: 1, batch_rank: 1, is_current: true };
  const answerRows = Array.from({ length: 201 }, (_, index) => ({ node_kind: "answer", node_id: `answer-${index + 1}`, revision: 1, project_id: "project-1", label: `Answer ${index + 1}`, state: "published", canonical_href: `/answers/answer-${index + 1}`, created_at: "2026-08-30T00:01:00.000Z", created_by: "human-1", commit_rank: index + 2, batch_rank: 1, is_current: true }));
  const edgeRows = answerRows.map((row, index) => ({ edge_id: `edge-${String(index + 1).padStart(3, "0")}`, edge_type: "answers", source_kind: "question", source_id: "question-1", source_revision: 1, target_kind: "answer", target_id: row.node_id, target_revision: 1, provenance_event_id: `event-${index + 1}`, created_by: "human-1", created_at: "2026-08-30T00:01:00.000Z" }));
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => {
      const endpoint = new URL(url);
      if (endpoint.pathname.endsWith("/research_graph_edges")) return Response.json(edgeRows);
      if (endpoint.searchParams.has("node_kind")) return Response.json([rootRow]);
      if (endpoint.searchParams.get("node_id")?.startsWith("in.(")) return Response.json([rootRow, ...answerRows]);
      if (endpoint.pathname.endsWith("/research_graph_nodes")) return Response.json([rootRow]);
      return Response.json([]);
    },
  });
  const query = { root: { kind: "question", id: "question-1", revision: 1 }, direction: "downstream", depth: 1, nodeKinds: [], edgeTypes: ["answers"], nodeLimit: 200, edgeLimit: 400 };
  const first = await repository.getResearchNeighborhood(query);
  assert.equal(first.nodes.length, 200);
  assert.equal(first.edges.length, 199);
  assert.equal(first.truncated, true);
  assert.equal(typeof first.nextCursor, "string");
  const second = await repository.getResearchNeighborhood({ ...query, cursor: first.nextCursor });
  assert.equal(second.edges.length, 2);
  assert.equal(second.nextCursor, null);
  assert.equal(second.graphWatermark, first.graphWatermark);
  assert.equal(new Set([...first.edges, ...second.edges].map((edge) => edge.id)).size, 201);
});

test("neighborhood cursor fails closed when the graph watermark advances", async () => {
  const rootRow = { node_kind: "question", node_id: "question-1", revision: 1, project_id: "project-1", label: "Question", state: "published", canonical_href: "/questions/question-1", created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1", commit_rank: 1, batch_rank: 1, is_current: true };
  const answerRow = { node_kind: "answer", node_id: "answer-1", revision: 1, project_id: "project-1", label: "Answer", state: "published", canonical_href: "/answers/answer-1", created_at: "2026-08-30T00:01:00.000Z", created_by: "human-1", commit_rank: 2, batch_rank: 1, is_current: true };
  const edgeRow = { edge_id: "edge-1", edge_type: "answers", source_kind: "question", source_id: "question-1", source_revision: 1, target_kind: "answer", target_id: "answer-1", target_revision: 1, provenance_event_id: "event-1", created_by: "human-1", created_at: "2026-08-30T00:01:00.000Z" };
  let watermarkReads = 0;
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => {
      const endpoint = new URL(url);
      if (endpoint.pathname.endsWith("/research_graph_edges")) return Response.json([edgeRow]);
      if (endpoint.searchParams.get("order")?.startsWith("commit_rank.desc")) {
        watermarkReads += 1;
        return Response.json([{ ...answerRow, commit_rank: watermarkReads === 1 ? 2 : 3 }]);
      }
      if (endpoint.searchParams.has("node_kind")) return Response.json([rootRow]);
      if (endpoint.searchParams.get("node_id")?.startsWith("in.(")) return Response.json([rootRow, answerRow]);
      return Response.json([rootRow]);
    },
  });
  const query = { root: { kind: "question", id: "question-1", revision: 1 }, direction: "downstream", depth: 1, nodeKinds: [], edgeTypes: ["answers"], nodeLimit: 1, edgeLimit: 400 };
  const first = await repository.getResearchNeighborhood(query);
  assert.equal(typeof first.nextCursor, "string");
  await assert.rejects(
    repository.getResearchNeighborhood({ ...query, cursor: first.nextCursor }),
    (error) => error.code === "SUPABASE_GRAPH_CURSOR_STALE" && error.status === 409,
  );
});

test("typed Answer list and detail hydrate semantic refs only from permission-aware views", async () => {
  const paths = [];
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => {
      const endpoint = new URL(url);
      paths.push(endpoint.pathname);
      if (endpoint.pathname.endsWith("/research_answers")) return Response.json([{
        node_id: "answer-1", answer_id: "answer-1", revision: 1, project_id: "project-1", state: "published", label: "Answer", canonical_href: "/answers/answer-1", created_at: "2026-08-30T01:00:00.000Z", created_by: "human-1", is_current: true, title: "Answer", synthesis: "Synthesis", limitations: [],
      }]);
      if (endpoint.pathname.endsWith("/research_graph_edges")) return Response.json([{
        edge_id: "edge-answer", edge_type: "answers", source_kind: "question", source_id: "question-1", source_revision: 2, target_kind: "answer", target_id: "answer-1", target_revision: 1, provenance_event_id: "event-1", created_by: "human-1", created_at: "2026-08-30T01:00:00.000Z",
      }]);
      return Response.json([]);
    },
  });
  const list = await repository.listAnswers({ projectId: "project-1" });
  const revision = await repository.getCurrentAnswerRevision("answer-1");
  assert.equal(list[0].answerId, "answer-1");
  assert.deepEqual(revision.questionRef, { kind: "question", id: "question-1", revision: 2 });
  assert.ok(paths.includes("/rest/v1/research_answers"));
  assert.ok(paths.includes("/rest/v1/research_graph_edges"));
  assert.ok(paths.every((path) => !path.includes("private")));
});

test("kernel Claim compatibility restores the exact legacy relation only through the service-only crosswalk", async () => {
  const root = {
    node_kind: "claim", node_id: "claim-root", revision: 1, project_id: "project-1",
    label: "Root claim", state: "published", canonical_href: "/claims/claim-root",
    created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1",
    commit_rank: 1, batch_rank: 1, is_current: true,
  };
  const source = {
    node_kind: "claim", node_id: "claim-source", revision: 1, project_id: "project-1",
    label: "Source claim", state: "published", canonical_href: "/claims/claim-source",
    created_at: "2026-08-30T00:01:00.000Z", created_by: "human-1",
    commit_rank: 2, batch_rank: 1, is_current: true,
  };
  const evaluation = {
    node_kind: "evaluation", node_id: "evaluation-1", revision: 1, project_id: "project-1",
    label: "Supports", state: "published", canonical_href: "/evaluations/evaluation-1",
    created_at: "2026-08-30T00:02:00.000Z", created_by: "human-1",
    commit_rank: 3, batch_rank: 1, is_current: true,
  };
  const edges = [
    {
      edge_id: "edge-subject", edge_type: "evaluates",
      source_kind: "claim", source_id: "claim-root", source_revision: 1,
      target_kind: "evaluation", target_id: "evaluation-1", target_revision: 1,
      provenance_event_id: "event-1", created_by: "human-1", created_at: "2026-08-30T00:02:00.000Z",
    },
    {
      edge_id: "edge-basis", edge_type: "evaluation_basis",
      source_kind: "claim", source_id: "claim-source", source_revision: 1,
      target_kind: "evaluation", target_id: "evaluation-1", target_revision: 1,
      provenance_event_id: "event-1", created_by: "human-1", created_at: "2026-08-30T00:02:00.000Z",
    },
  ];
  const calls = [];
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    serviceRoleKey: "server-secret",
    fetchImpl: async (url, init = {}) => {
      const endpoint = new URL(url);
      calls.push({ path: endpoint.pathname, authorization: init.headers?.authorization ?? null });
      if (endpoint.pathname.endsWith("/research_graph_legacy_relations")) {
        assert.equal(init.headers?.authorization, "Bearer server-secret");
        return Response.json([{
          mapping_id: "mapping-1", project_id: "project-1", source: "claim_relation",
          source_key: "claim-source|supports|claim-root", mapping_kind: "evaluation_motif", status: "mapped",
          source_payload: {
            sourceClaimId: "claim-source", sourceRevision: 1,
            targetClaimId: "claim-root", targetRevision: 1,
            relationType: "supports",
          },
          mapped_node_kind: "evaluation", mapped_node_id: "evaluation-1", mapped_node_revision: 1,
          mapped_edge_id: null,
        }]);
      }
      if (endpoint.pathname.endsWith("/research_graph_edges")) return Response.json(edges);
      if (endpoint.pathname.endsWith("/claims")) return Response.json([{
        claim_id: "claim-source", question_id: "question-1", state: "accepted",
        created_by: "human-1", created_at: "2026-08-30T00:01:00.000Z",
      }]);
      if (endpoint.pathname.endsWith("/research_graph_nodes")) {
        if (endpoint.searchParams.get("order")?.startsWith("commit_rank.desc")) return Response.json([evaluation]);
        const ids = endpoint.searchParams.get("node_id") ?? "";
        if (ids.startsWith("in.(")) return Response.json([root, source, evaluation]);
        if (ids === "eq.claim-root") return Response.json([root]);
        if (ids === "eq.claim-source") return Response.json([source]);
      }
      return Response.json([]);
    },
  });

  const graph = await repository.getLegacyClaimGraphFromResearchGraph({
    claimId: "claim-root", maxDepth: 1, direction: "upstream",
  });

  assert.deepEqual(graph.nodes.map((node) => node.claimId), ["claim-source"]);
  assert.deepEqual(graph.edges.map((edge) => ({
    sourceClaimId: edge.sourceClaimId,
    targetClaimId: edge.targetClaimId,
    relationType: edge.relationType,
  })), [{ sourceClaimId: "claim-source", targetClaimId: "claim-root", relationType: "supports" }]);
  assert.equal(graph.permissionPartial, true);
  assert.equal(calls.filter((call) => call.path.endsWith("/research_graph_legacy_relations")).length > 0, true);
  assert.equal(calls.filter((call) => !call.path.endsWith("/research_graph_legacy_relations"))
    .every((call) => call.authorization === null), true, "service role must not replace caller RLS for graph/content reads");
});

test("kernel compatibility drops node-mapped crosswalk rows when a restored endpoint is hidden", async () => {
  const root = {
    node_kind: "claim", node_id: "claim-root", revision: 1, project_id: "project-public",
    label: "Root claim", state: "published", canonical_href: "/claims/claim-root",
    created_at: "2026-08-30T00:00:00.000Z", created_by: "human-1",
    commit_rank: 1, batch_rank: 1, is_current: true,
  };
  const evaluation = {
    node_kind: "evaluation", node_id: "evaluation-1", revision: 1, project_id: "project-public",
    label: "Supports", state: "published", canonical_href: "/evaluations/evaluation-1",
    created_at: "2026-08-30T00:02:00.000Z", created_by: "human-1",
    commit_rank: 3, batch_rank: 1, is_current: true,
  };
  const subjectEdge = {
    edge_id: "edge-subject", edge_type: "evaluates",
    source_kind: "claim", source_id: "claim-root", source_revision: 1,
    target_kind: "evaluation", target_id: "evaluation-1", target_revision: 1,
    provenance_event_id: "event-1", created_by: "human-1", created_at: "2026-08-30T00:02:00.000Z",
  };
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    serviceRoleKey: "sb_secret_test",
    fetchImpl: async (url) => {
      const endpoint = new URL(url);
      if (endpoint.pathname.endsWith("/research_graph_legacy_relations")) return Response.json([{
        mapping_id: "mapping-hidden", project_id: "project-public", source: "claim_relation",
        source_key: "claim-hidden|supports|claim-root", mapping_kind: "evaluation", status: "mapped",
        source_payload: {
          sourceClaimId: "claim-hidden", sourceRevision: 4,
          targetClaimId: "claim-root", targetRevision: 1,
          relationType: "supports",
        },
        mapped_node_kind: "evaluation", mapped_node_id: "evaluation-1", mapped_node_revision: 1,
        mapped_edge_id: null,
      }]);
      if (endpoint.pathname.endsWith("/research_graph_edges")) return Response.json([subjectEdge]);
      if (endpoint.pathname.endsWith("/research_graph_nodes")) {
        if (endpoint.searchParams.get("order")?.startsWith("commit_rank.desc")) return Response.json([evaluation]);
        const ids = endpoint.searchParams.get("node_id") ?? "";
        if (ids.startsWith("in.(")) return Response.json([root, evaluation]);
        if (ids === "eq.claim-root") return Response.json([root]);
      }
      if (endpoint.pathname.endsWith("/claims")) throw new Error("hidden Claim IDs must never reach legacy hydration");
      return Response.json([]);
    },
  });

  const graph = await repository.getLegacyClaimGraphFromResearchGraph({
    claimId: "claim-root", maxDepth: 1, direction: "upstream",
  });

  assert.deepEqual(graph.nodes, []);
  assert.deepEqual(graph.edges, []);
  assert.equal(graph.permissionPartial, true);
  assert.doesNotMatch(JSON.stringify(graph), /claim-hidden/);
});

test("production dual-write adapter calls the service-only typed transaction RPC once", async () => {
  const requests = [];
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    serviceRoleKey: "server-secret",
    fetchImpl: async (url, init = {}) => {
      requests.push({ url: new URL(url), init });
      return Response.json({
        legacy: { claim: { claimId: "claim-1" } },
        kernel: { node: { nodeKind: "claim", nodeId: "claim-1" } },
        parity: true,
      });
    },
  });
  const verifiedEvent = {
    eventId: "01993f21-16f8-7f01-8e42-0123456789ab", eventType: "claim.created",
    payload: { entity_type: "claim", claim_id: "claim-1" }, hash: `sha256:${"a".repeat(64)}`,
    signature: { algorithm: "Ed25519", key_id: "human-key", value: "signature" }, parents: [],
  };
  const result = await repository.executeLegacyResearchMutationDualWrite({
    mutationKind: "claim.create",
    command: { claimId: "claim-1", actorId: "human-1" },
    verifiedEvents: [verifiedEvent],
    expectedLegacy: { claim: { claimId: "claim-1" }, event: verifiedEvent },
  });

  assert.equal(result.parity, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, "/rest/v1/rpc/execute_research_graph_legacy_dual_write");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers.apikey, "server-secret");
  assert.equal(requests[0].init.headers.authorization, "Bearer server-secret");
  const body = JSON.parse(requests[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), ["p_command", "p_expected_legacy", "p_mutation_kind", "p_verified_events"]);
  assert.equal(body.p_mutation_kind, "claim.create");
  assert.equal(body.p_verified_events[0].hash, verifiedEvent.hash);
});

test("opaque Supabase secret keys are API keys and are never sent as bearer JWTs", async () => {
  const requests = [];
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    serviceRoleKey: "sb_secret_test",
    fetchImpl: async (url, init = {}) => {
      requests.push({ url: new URL(url), init });
      return Response.json({ legacy: {}, kernel: {}, parity: true });
    },
  });

  await repository.executeLegacyResearchMutationDualWrite({
    mutationKind: "claim.create",
    command: { claimId: "claim-1", actorId: "human-1", actorRole: "maintainer" },
    verifiedEvents: [{
      event_id: "01993f21-16f8-7f01-8e42-0123456789ab",
      event_type: "claim.created",
      payload: { entity_type: "claim", claim_id: "claim-1" },
      hash: `sha256:${"a".repeat(64)}`,
      signature: { algorithm: "Ed25519", key_id: "human-key", value: "signature" },
      parents: [],
    }],
    expectedLegacy: {},
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.headers.apikey, "sb_secret_test");
  assert.equal(Object.hasOwn(requests[0].init.headers, "authorization"), false);
});

test("transaction RPC preserves stable database guard codes as caller-facing 4xx errors", async () => {
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    serviceRoleKey: "sb_secret_test",
    fetchImpl: async () => Response.json({
      code: "P0001",
      message: "[RESEARCH_GRAPH_DUAL_WRITE_REVISION_RACE] current Claim revision changed after planning",
    }, { status: 400 }),
  });

  await assert.rejects(
    repository.executeLegacyResearchMutationDualWrite({
      mutationKind: "claim.revise",
      command: { claimId: "claim-1", actorId: "human-1", actorRole: "maintainer" },
      verifiedEvents: [{}],
      expectedLegacy: {},
    }),
    (error) => error.code === "RESEARCH_GRAPH_DUAL_WRITE_REVISION_RACE"
      && error.status === 409
      && /current Claim revision changed/.test(error.message),
  );
});

test("transaction adapter maps the complete 0082 guard registry without collapsing failures to 5xx", async () => {
  const categories = new Map([
    [400, ["INPUT_INVALID", "KIND_INVALID", "EVENT_COUNT", "EVENT_INVALID", "EVENT_PARENT_INVALID", "NODE_INVALID", "REVISION_INVALID"]],
    [403, ["FORBIDDEN", "ROLE_MISMATCH", "SERVICE_ROLE_REQUIRED"]],
    [409, [
      "CROSSWALK_CONFLICT", "DANGLING", "EDGE_CONFLICT", "EVENT_CONFLICT", "EVENT_MISMATCH",
      "LEGACY_CONFLICT", "MOTIF_CONFLICT", "NODE_CONFLICT", "PARITY_MISMATCH", "PROJECT_UNRESOLVED",
      "REVISION_CONFLICT", "REVISION_GAP", "REVISION_RACE", "STATE_INVALID",
    ]],
  ]);
  for (const [status, suffixes] of categories) {
    for (const suffix of suffixes) {
      const code = `RESEARCH_GRAPH_DUAL_WRITE_${suffix}`;
      const repository = createSupabaseReadRepository({
        url: "https://project.supabase.co",
        publishableKey: "sb_publishable_test",
        serviceRoleKey: "sb_secret_test",
        fetchImpl: async () => Response.json({ code: "P0001", message: `[${code}] guarded` }, { status: 400 }),
      });
      await assert.rejects(
        repository.executeLegacyResearchMutationDualWrite({
          mutationKind: "claim.create", command: {}, verifiedEvents: [{}], expectedLegacy: {},
        }),
        (error) => error.code === code && error.status === status,
        code,
      );
    }
  }
});
