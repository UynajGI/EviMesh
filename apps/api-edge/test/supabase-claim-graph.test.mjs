import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseReadRepository } from "../src/supabase-read-repository.mjs";

function assertAcyclic(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    const targets = adjacency.get(edge.sourceClaimId) ?? [];
    targets.push(edge.targetClaimId);
    adjacency.set(edge.sourceClaimId, targets);
  }
  function visit(node, visiting = new Set(), visited = new Set()) {
    if (visiting.has(node)) return false;
    if (visited.has(node)) return true;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) if (!visit(next, visiting, visited)) return false;
    visiting.delete(node);
    visited.add(node);
    return true;
  }
  assert.ok([...adjacency.keys()].every((node) => visit(node)), "typed Claim graph must remain acyclic");
}

test("reads bounded upstream and downstream Claim graphs with typed relations", async () => {
  const relationQueries = [];
  const claimQueries = [];
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => {
      const endpoint = new URL(url);
      const path = endpoint.pathname;
      if (path.endsWith("/claim_relations")) assert.equal(endpoint.searchParams.get("deleted_at"), "is.null", "ended Claim relations must not enter the active graph");
      if (path.endsWith("/claim_relations") && endpoint.searchParams.has("or")) relationQueries.push(endpoint);
      if (path.endsWith("/claims")) claimQueries.push(endpoint);
      if (path.endsWith("/claim_relations") && endpoint.searchParams.has("target_claim_id")) return Response.json([
        { source_claim_id: "claim-child", target_claim_id: "claim-a", relation_type: "depends_on", deleted_at: null },
      ]);
      if (path.endsWith("/claim_relations")) return Response.json([
        { source_claim_id: "claim-a", target_claim_id: "claim-root", relation_type: "depends_on", deleted_at: null },
        { source_claim_id: "claim-support", target_claim_id: "claim-root", relation_type: "supports", deleted_at: null },
        { source_claim_id: "claim-root", target_claim_id: "claim-support", relation_type: "refutes", deleted_at: null },
        { source_claim_id: "claim-child", target_claim_id: "claim-a", relation_type: "depends_on", deleted_at: null },
      ]);
      if (path.endsWith("/claims")) return Response.json([
        { claim_id: "claim-root", state: "candidate", deleted_at: null },
        { claim_id: "claim-a", state: "candidate", deleted_at: null },
        { claim_id: "claim-support", state: "provisionally_accepted", deleted_at: null },
        { claim_id: "claim-child", state: "dependency_tainted", deleted_at: null },
      ]);
      return Response.json([]);
    },
  });

  const upstream = await repository.getClaimUpstreamGraph({ claimId: "claim-child", maxDepth: 3 });
  const downstream = await repository.getClaimDownstreamGraph({ claimId: "claim-root", maxDepth: 2 });

  assert.deepEqual(upstream.nodes.map((node) => node.claimId), ["claim-a", "claim-root", "claim-support"]);
  assert.deepEqual(upstream.edges.map((edge) => edge.relationType), ["depends_on", "depends_on", "supports"]);
  assert.deepEqual(downstream.nodes.map((node) => node.claimId), ["claim-a", "claim-support", "claim-child"]);
  assert.equal(downstream.nodes[2].state, "dependency_tainted");
  assertAcyclic(upstream.edges);
  assertAcyclic(downstream.edges);

  const supportUpstream = await repository.getClaimUpstreamGraph({ claimId: "claim-root", maxDepth: 1 });
  const supportDownstream = await repository.getClaimDownstreamGraph({ claimId: "claim-support", maxDepth: 1 });
  assert.deepEqual(supportUpstream.nodes.map((node) => node.claimId), ["claim-support"]);
  assert.deepEqual(supportUpstream.edges.map((edge) => edge.relationType), ["supports"]);
  assert.deepEqual(supportDownstream.nodes.map((node) => node.claimId), ["claim-root"]);
  assert.deepEqual(supportDownstream.edges.map((edge) => edge.relationType), ["supports"]);
  assertAcyclic(supportUpstream.edges);
  assertAcyclic(supportDownstream.edges);

  assert.deepEqual(await repository.listDirectDependentClaimIds("claim-a"), ["claim-child"]);
  assert.ok(relationQueries.length > 0);
  assert.ok(relationQueries.every((endpoint) => endpoint.searchParams.get("or")?.includes("source_claim_id.in.")), "graph reads must query only the current frontier");
  assert.ok(relationQueries.some((endpoint) => endpoint.searchParams.get("or")?.includes('"claim-a","claim-support"')), "broad frontiers must share one relation query");
  assert.ok(claimQueries.length > 0);
  assert.ok(claimQueries.every((endpoint) => endpoint.searchParams.get("claim_id")?.startsWith("in.(")), "graph reads must hydrate only discovered Claims");
  assert.ok(claimQueries.every((endpoint) => endpoint.searchParams.get("claim_id")?.split(",").length <= 50), "Claim hydration batches must remain bounded");
});

test("preserves punctuation in Claim IDs used by graph membership filters", async () => {
  let relationFilter;
  let claimFilter;
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => {
      const endpoint = new URL(url);
      if (endpoint.pathname.endsWith("/claim_relations")) {
        relationFilter = endpoint.searchParams.get("or");
        return Response.json([
          { source_claim_id: "claim,a", target_claim_id: "claim)root", relation_type: "depends_on", deleted_at: null },
        ]);
      }
      if (endpoint.pathname.endsWith("/claims")) {
        claimFilter = endpoint.searchParams.get("claim_id");
        return Response.json([{ claim_id: "claim)root", state: "candidate", deleted_at: null }]);
      }
      return Response.json([]);
    },
  });

  const graph = await repository.getClaimUpstreamGraph({ claimId: "claim,a", maxDepth: 1 });

  assert.deepEqual(graph.nodes.map((node) => node.claimId), ["claim)root"]);
  assert.equal(relationFilter, '(source_claim_id.in.("claim,a"),target_claim_id.in.("claim,a"))');
  assert.equal(claimFilter, 'in.("claim)root")');
});

test("hydrates broad Claim graph frontiers in bounded batches", async () => {
  const hydrationBatchSizes = [];
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => {
      const endpoint = new URL(url);
      if (endpoint.pathname.endsWith("/claim_relations")) {
        return Response.json(Array.from({ length: 121 }, (_, index) => ({
          source_claim_id: `claim-${index}`,
          target_claim_id: "claim-root",
          relation_type: "depends_on",
          deleted_at: null,
        })));
      }
      if (endpoint.pathname.endsWith("/claims")) {
        const filter = endpoint.searchParams.get("claim_id");
        const claimIds = filter.slice("in.(".length, -1).split(",");
        hydrationBatchSizes.push(claimIds.length);
        return Response.json(claimIds.map((claimId) => ({ claim_id: claimId, state: "candidate", deleted_at: null })));
      }
      return Response.json([]);
    },
  });

  const graph = await repository.getClaimDownstreamGraph({ claimId: "claim-root", maxDepth: 1 });
  assert.equal(graph.nodes.length, 121);
  assert.deepEqual(hydrationBatchSizes, [50, 50, 21]);
});
