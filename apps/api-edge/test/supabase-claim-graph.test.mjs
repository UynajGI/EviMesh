import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseReadRepository } from "../src/supabase-read-repository.mjs";

test("reads bounded upstream and downstream Claim graphs with typed relations", async () => {
  const repository = createSupabaseReadRepository({
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/claim_relations")) return Response.json([
        { source_claim_id: "claim-a", target_claim_id: "claim-root", relation_type: "depends_on", deleted_at: null },
        { source_claim_id: "claim-support", target_claim_id: "claim-root", relation_type: "supports", deleted_at: null },
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
  assert.deepEqual(downstream.nodes.map((node) => node.claimId), ["claim-a", "claim-child"]);
  assert.equal(downstream.nodes[1].state, "dependency_tainted");

  const supportUpstream = await repository.getClaimUpstreamGraph({ claimId: "claim-root", maxDepth: 1 });
  const supportDownstream = await repository.getClaimDownstreamGraph({ claimId: "claim-support", maxDepth: 1 });
  assert.deepEqual(supportUpstream.nodes.map((node) => node.claimId), ["claim-support"]);
  assert.deepEqual(supportUpstream.edges.map((edge) => edge.relationType), ["supports"]);
  assert.deepEqual(supportDownstream.nodes.map((node) => node.claimId), ["claim-root"]);
});
