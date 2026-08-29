/*
 * Local demo stack: the real api-edge Worker (Hono routes + hosted read
 * repository) with the network layer replaced by an in-memory PostgREST
 * simulator seeded with a small protocol-coherent research story.
 *
 * Purpose: render the web app against data that exercises the design book's
 * core surfaces (claim detail, five-edge-family DAG, fielded receipts,
 * findings severities, attribution chains) without touching hosted Supabase.
 *
 * Usage:
 *   node scripts/demo-stack.mjs            # serves http://127.0.0.1:8787
 * Then run the web app against it:
 *   NEXT_PUBLIC_EVIMESH_API_URL=http://127.0.0.1:8787 pnpm --filter @evimesh/web dev
 */
import { createServer } from "node:http";
import { createWorker } from "../apps/api-edge/src/index.mjs";

/* ---------------------------------------------------------------- tables --
 * Rows are snake_case exactly as PostgREST would return them; the repository
 * maps them to camelCase internally. */

const now = Date.parse("2026-08-28T12:00:00Z");
const iso = (hoursAgo) => new Date(now - hoursAgo * 3600_000).toISOString();

const TABLES = {
  actors: [
    { actor_id: "actor-lin", actor_type: "human", identity_strength: "oauth_verified", auth_subject: "sub-lin", display_name: "Lin Zhiyao", created_at: iso(900), updated_at: iso(2), deleted_at: null },
    { actor_id: "actor-chen", actor_type: "human", identity_strength: "oauth_verified", auth_subject: "sub-chen", display_name: "Chen Mo", created_at: iso(880), updated_at: iso(5), deleted_at: null },
    { actor_id: "actor-atlas", actor_type: "agent", identity_strength: "self_declared", auth_subject: null, display_name: "atlas-07", owner_actor_id: "actor-lin", model_self_declared: "glm-5.3-flash", scope_self_declared: "read:drafts", created_at: iso(700), updated_at: iso(30), deleted_at: null },
    { actor_id: "actor-witness", actor_type: "agent", identity_strength: "self_declared", auth_subject: null, display_name: "witness-01", owner_actor_id: "actor-chen", model_self_declared: "claude-sonnet", scope_self_declared: "read:verify", created_at: iso(690), updated_at: iso(40), deleted_at: null },
  ],
  actor_profiles: [
    { actor_id: "actor-lin", orcid_id: "0000-0002-1825-0097", affiliation: "Independent lab", bio: "Reproducibility researcher. Signs what her agents draft.", deleted_at: null },
    { actor_id: "actor-chen", orcid_id: "0000-0001-5109-3700", affiliation: "Open Verification Collective", bio: "Blind verification and adversarial review.", deleted_at: null },
    { actor_id: "actor-atlas", bio: "Drafts claims and records runs under human approval.", deleted_at: null },
  ],
  questions: [
    { question_id: "q-contrastive", project_id: "proj-contrastive", state: "active", title: "Can contrastive learning gains be reproduced in few-shot settings?", topics: ["contrastive-learning", "few-shot", "reproducibility"], created_by: "actor-lin", created_at: iso(800), deleted_at: null },
  ],
  question_revisions: [
    { question_id: "q-contrastive", revision: 1, title: "Can contrastive learning gains be reproduced in few-shot settings?", statement: "Independent reproductions of published contrastive few-shot gains, run blind against a frozen protocol.", background: "Contrastive pretraining reports consistent few-shot gains, but independent reproductions are rare and rarely blind.", research_contract: { contract_id: "contract-demo-1", revision: 1 }, created_by: "actor-lin", created_at: iso(800), deleted_at: null },
  ],
  research_contract_revisions: [
    { contract_id: "contract-demo-1", revision: 1, problem: "Published contrastive few-shot gains lack independent blind reproductions.", definitions: { "few-shot": "k<=16 labelled samples per class" }, background: "Two published baselines report consistent gains; no independent replication exists.", scope: ["SimCLR-style pretraining", "MoCo v2 baseline"], exclusions: ["supervised pretraining variants"], progress_criteria: { metric: "top-1 accuracy delta", target: "within 1 point of reported" }, acceptable_evidence: ["blind replication with frozen harness", "2+ independent seeds"], falsification: "A matched-protocol rerun missing reported accuracy by more than 2 points on 3 of 4 benchmarks falsifies the gain.", license: "CC-BY-4.0", risk_level: "standard", maintainer_ids: ["actor-lin"], created_by: "actor-lin", created_at: iso(790), deleted_at: null },
  ],
  projects: [
    { project_id: "proj-contrastive", question_id: "q-contrastive", name: "Contrastive reproducibility project", summary: "Two baselines, four benchmarks, three blind verifiers.", created_by: "actor-lin", created_at: iso(780), deleted_at: null },
  ],
  project_revisions: [
    { project_id: "proj-contrastive", revision: 1, name: "Contrastive reproducibility project", summary: "Two baselines, four benchmarks, three blind verifiers.", created_by: "actor-lin", created_at: iso(780), deleted_at: null },
  ],
  claims: [
    { claim_id: "claim-a1b2", question_id: "q-contrastive", project_id: "proj-contrastive", state: "provisionally_accepted", created_by: "actor-atlas", created_at: iso(700), updated_at: iso(24), deleted_at: null },
    { claim_id: "claim-d4e5", question_id: "q-contrastive", project_id: "proj-contrastive", state: "contested", created_by: "actor-atlas", created_at: iso(640), updated_at: iso(12), deleted_at: null },
    { claim_id: "claim-g7h8", question_id: "q-contrastive", project_id: "proj-contrastive", state: "refuted", created_by: "actor-lin", created_at: iso(600), updated_at: iso(48), deleted_at: null },
  ],
  claim_revisions: [
    { claim_id: "claim-a1b2", revision: 1, statement: "SimCLR-style pretraining narrows the few-shot gap to within 1.2 points of the supervised baseline when evaluation protocols are matched.", created_by: "actor-atlas", drafted_by: "actor-atlas", created_at: iso(700), deleted_at: null },
    { claim_id: "claim-a1b2", revision: 2, statement: "SimCLR-style pretraining narrows the few-shot gap to within 1.0 points of the supervised baseline when evaluation protocols are exactly matched, across four benchmarks.", created_by: "actor-atlas", drafted_by: "actor-atlas", created_at: iso(120), deleted_at: null },
    { claim_id: "claim-d4e5", revision: 1, statement: "Augmentation choices in contrastive pretraining introduce unreported variance that exceeds the reported confidence intervals.", created_by: "actor-atlas", drafted_by: "actor-atlas", created_at: iso(640), deleted_at: null },
    { claim_id: "claim-g7h8", revision: 1, statement: "The original few-shot gains are an artifact of prompt selection and do not survive protocol matching.", created_by: "actor-lin", drafted_by: "actor-lin", created_at: iso(600), deleted_at: null },
  ],
  claim_relations: [
    { source_claim_id: "claim-a1b2", target_claim_id: "claim-d4e5", relation_type: "depends_on", deleted_at: null },
    { source_claim_id: "claim-d4e5", target_claim_id: "claim-g7h8", relation_type: "refutes", deleted_at: null },
    { source_claim_id: "claim-g7h8", target_claim_id: "claim-a1b2", relation_type: "supports", deleted_at: null },
    { source_claim_id: "claim-d4e5", target_claim_id: "claim-a1b2", relation_type: "qualifies", deleted_at: null },
    { source_claim_id: "claim-g7h8", target_claim_id: "claim-d4e5", relation_type: "derived_from", deleted_at: null },
  ],
  evidence: [
    { evidence_id: "ev-simclr", created_by: "actor-atlas", created_at: iso(660), deleted_at: null },
    { evidence_id: "ev-moco", created_by: "actor-atlas", created_at: iso(650), deleted_at: null },
    { evidence_id: "ev-refute", created_by: "actor-chen", created_at: iso(100), deleted_at: null },
  ],
  evidence_revisions: [
    { evidence_id: "ev-simclr", revision: 1, title: "SimCLR rerun under matched protocol", description: "Two seeds, frozen evaluation harness.", created_at: iso(660), deleted_at: null },
    { evidence_id: "ev-moco", revision: 1, title: "MoCo v2 baseline rerun", description: "Matched batch size and schedule.", created_at: iso(650), deleted_at: null },
    { evidence_id: "ev-refute", revision: 1, title: "Prompt-sensitivity probe", description: "Gain disappears under 4 of 6 prompt variants.", created_at: iso(100), deleted_at: null },
  ],
  evidence_claim_links: [
    { evidence_id: "ev-simclr", claim_id: "claim-a1b2", relation_type: "supports", created_by: "actor-atlas", created_at: iso(660), deleted_at: null },
    { evidence_id: "ev-moco", claim_id: "claim-a1b2", relation_type: "supports", created_by: "actor-atlas", created_at: iso(650), deleted_at: null },
    { evidence_id: "ev-refute", claim_id: "claim-g7h8", relation_type: "refutes", created_by: "actor-chen", created_at: iso(100), deleted_at: null },
  ],
  runs: [
    { run_id: "run-demo-1", claim_id: "claim-a1b2", produced_by: "actor-atlas", signing_key_id: "key-atlas-1", signature: { algorithm: "Ed25519", keyId: "key-atlas-1", value: "demo-signature-bytes" }, source_code: "https://github.com/demo/contrastive@4f2c9d1", container: "ghcr.io/demo/contrastive@sha256:9f2c11af", environment: { python: "3.12", torch: "2.6" }, hardware: { gpu: "1x A100 80GB", driver: "550.54" }, created_at: iso(690), deleted_at: null },
  ],
  run_inputs: [
    { run_id: "run-demo-1", artifact_id: "art-dataset", created_at: iso(690), deleted_at: null },
  ],
  run_outputs: [
    { run_id: "run-demo-1", artifact_id: "art-metrics", created_at: iso(690), deleted_at: null },
  ],
  artifacts: [
    { artifact_id: "art-dataset", artifact_type: "dataset", created_by: "actor-atlas", created_at: iso(695), deleted_at: null },
    { artifact_id: "art-metrics", artifact_type: "result", created_by: "actor-atlas", created_at: iso(688), deleted_at: null },
  ],
  artifact_revisions: [
    { artifact_id: "art-dataset", revision: 1, name: "few-shot-bench v3", created_at: iso(695), deleted_at: null },
    { artifact_id: "art-metrics", revision: 1, name: "rerun-metrics.json", created_at: iso(688), deleted_at: null },
  ],
  artifact_locations: [
    { artifact_id: "art-metrics", uri: "s3://demo-bucket/artifacts/rerun-metrics.json", created_at: iso(688), deleted_at: null },
  ],
  verification_receipts: [
    { receipt_id: "rec-blind-1", claim_id: "claim-a1b2", verifier_actor_id: "actor-chen", outcome: "supports", verification_types: ["blind", "replication"], context_mode: "statement_only", created_at: iso(60), deleted_at: null },
  ],
  verification_findings: [
    { receipt_id: "rec-blind-1", severity: "critical", title: "Benchmark leakage in protocol harness", description: "The frozen harness shared a preprocessing step with the training split for one benchmark.", created_at: iso(60), deleted_at: null },
    { receipt_id: "rec-blind-1", severity: "major", title: "Seed variance understated", description: "Reported interval uses 2 seeds; rerun with 5 widens it beyond the claim.", created_at: iso(60), deleted_at: null },
    { receipt_id: "rec-blind-1", severity: "note", title: "Logging gap", description: "One run lacked full trace logs.", created_at: iso(60), deleted_at: null },
  ],
  challenges: [
    { challenge_id: "chal-variance", claim_id: "claim-d4e5", state: "investigating", created_by: "actor-chen", created_at: iso(50), updated_at: iso(6), deleted_at: null },
  ],
  challenge_revisions: [
    { challenge_id: "chal-variance", revision: 1, state: "investigating", statement: "The unreported augmentation variance claim rests on one benchmark; extend to all four before it can stand.", created_by: "actor-chen", created_at: iso(50), deleted_at: null },
  ],
  challenge_impacts: [
    { challenge_id: "chal-variance", challenge_revision: 1, impacted_claim_id: "claim-d4e5", impact: "under_review", created_at: iso(50), deleted_at: null },
  ],
  frontier_snapshots: [
    { snapshot_id: "fs-2026-08", project_id: "proj-contrastive", question_id: "q-contrastive", sequence: 3, state: "published", published_at: iso(24), created_by: "actor-lin", created_at: iso(24), deleted_at: null },
  ],
  frontier_members: [
    { snapshot_id: "fs-2026-08", claim_id: "claim-a1b2", revision: 2, membership_type: "member", created_at: iso(24), deleted_at: null },
  ],
  contribution_statements: [
    { statement_id: "st-origin", actor_id: "actor-lin", role: "originator", description: "Originated the reproducibility question and signed the frontier snapshot.", event_id: "ev-0001", created_at: iso(800), deleted_at: null },
    { statement_id: "st-draft", actor_id: "actor-atlas", role: "originator", description: "Drafted claim-a1b2 and recorded its run under human approval.", event_id: "ev-0004", created_at: iso(700), deleted_at: null },
    { statement_id: "st-verify", actor_id: "actor-chen", role: "verifier", description: "Completed blind verification rec-blind-1.", event_id: "ev-0013", created_at: iso(60), deleted_at: null },
  ],
  contribution_edges: [
    { statement_id: "st-origin", object_type: "question", object_id: "q-contrastive", edge_type: "produced", object_revision: 1, created_at: iso(800), deleted_at: null },
    { statement_id: "st-draft", object_type: "claim", object_id: "claim-a1b2", edge_type: "produced", object_revision: 2, created_at: iso(120), deleted_at: null },
    { statement_id: "st-draft", object_type: "run", object_id: "run-demo-1", edge_type: "used", object_revision: null, created_at: iso(120), deleted_at: null },
    { statement_id: "st-verify", object_type: "claim", object_id: "claim-a1b2", edge_type: "verified", object_revision: 2, created_at: iso(60), deleted_at: null },
  ],
  tasks: [
    { task_id: "task-verify-g7h8", question_id: "q-contrastive", task_type: "verification", state: "open", created_by: "actor-lin", created_at: iso(30), updated_at: iso(2), deleted_at: null },
  ],
  task_revisions: [
    { task_id: "task-verify-g7h8", revision: 1, title: "Independently verify claim-g7h8 refutation", created_by: "actor-lin", created_at: iso(30), deleted_at: null },
  ],
  signing_keys: [
    { key_id: "key-atlas-1", actor_id: "actor-atlas", public_key: "demo-public-key-bytes", revoked_at: null, created_at: iso(700), deleted_at: null },
  ],
  research_events: buildEvents(),
};

function buildEvents() {
  const events = [];
  const chain = [];
  const add = (hoursAgo, type, actorId, payload) => {
    const event_id = `ev-${String(events.length + 1).padStart(4, "0")}`;
    const hash = `blk${String(events.length + 1).padStart(4, "0")}${"9f2c11af".repeat(6)}`.slice(0, 40);
    const row = {
      event_id,
      event_type: type,
      actor_id: actorId,
      payload,
      hash,
      parents: [...chain],
      signature: { algorithm: "Ed25519", keyId: "demo", value: "demo-signature" },
      created_at: iso(hoursAgo),
      deleted_at: null,
    };
    chain.length = 0;
    chain.push(hash);
    events.push(row);
  };
  add(800, "question.created", "actor-lin", { question_id: "q-contrastive", title: "Can contrastive learning gains be reproduced in few-shot settings?" });
  add(790, "contract.published", "actor-lin", { contract_id: "contract-demo-1", question_id: "q-contrastive" });
  add(780, "project.created", "actor-lin", { project_id: "proj-contrastive", question_id: "q-contrastive" });
  add(700, "claim.created", "actor-atlas", { claim_id: "claim-a1b2", question_id: "q-contrastive", drafted_by_actor_id: "actor-atlas", signer_actor_id: "actor-lin", claim_state: "draft" });
  add(695, "run.recorded", "actor-atlas", { run_id: "run-demo-1", claim_id: "claim-a1b2", producer_actor_id: "actor-atlas" });
  add(660, "evidence.linked", "actor-atlas", { evidence_id: "ev-simclr", claim_id: "claim-a1b2", relation_type: "supports" });
  add(650, "evidence.linked", "actor-atlas", { evidence_id: "ev-moco", claim_id: "claim-a1b2", relation_type: "supports" });
  add(640, "claim.created", "actor-atlas", { claim_id: "claim-d4e5", question_id: "q-contrastive", claim_state: "draft", drafted_by_actor_id: "actor-atlas", signer_actor_id: "actor-lin" });
  add(600, "claim.state_changed", "actor-lin", { claim_id: "claim-g7h8", claim_state: "refuted", signer_actor_id: "actor-lin" });
  add(120, "claim.revised", "actor-atlas", { claim_id: "claim-a1b2", claim_state: "provisionally_accepted", drafted_by_actor_id: "actor-atlas", signer_actor_id: "actor-lin" });
  add(100, "evidence.linked", "actor-chen", { evidence_id: "ev-refute", claim_id: "claim-g7h8", relation_type: "refutes" });
  add(61, "verification.completed", "actor-chen", { receipt_id: "rec-blind-1", claim_id: "claim-a1b2", outcome: "supports", verifier_actor_id: "actor-chen" });
  add(60, "finding.reported", "actor-chen", { receipt_id: "rec-blind-1", claim_id: "claim-a1b2", severity: "critical", title: "Benchmark leakage in protocol harness" });
  add(50, "challenge.created", "actor-chen", { challenge_id: "chal-variance", claim_id: "claim-d4e5", challenge_state: "investigating" });
  add(24, "frontier.snapshot_published", "actor-lin", { snapshot_id: "fs-2026-08", project_id: "proj-contrastive", member_claim_id: "claim-a1b2", action: "add", has_impact: true });
  add(6, "challenge.updated", "actor-chen", { challenge_id: "chal-variance", claim_id: "claim-d4e5", challenge_state: "investigating" });
  add(2, "policy.updated", "actor-lin", { policy_revision_id: "pol-1", scope: "verification" });
  return events; // add() appends oldest-first; ids stay monotonic with created_at
}

/* ------------------------------------------------- postgrest simulator --
 * Deliberately loose: eq/in filters and ordering are honored; logical or()
 * /and() predicates are ignored because the repository mirrors event object
 * and actor predicates in JS after fetch (and research_events here is small
 * enough that a superset response is correct). */

function compareOp(value, op, expected) {
  if (op === "eq") return String(value) === expected.replace(/^"|"$/g, "");
  if (op === "gte") return String(value) >= expected;
  if (op === "lte") return String(value) <= expected;
  if (op === "is") return expected === "null" ? (value === null || value === undefined) : true;
  return true;
}

function applyFilter(rows, name, raw) {
  const value = decodeURIComponent(raw ?? "");
  if (value.startsWith("in.(")) {
    const members = value.slice(4, -1).split(",").map((m) => m.replace(/^"|"$/g, ""));
    return rows.filter((row) => members.includes(String(row[name])));
  }
  const match = value.match(/^(eq|gte|lte|is)\.(.*)$/s);
  if (match) return rows.filter((row) => compareOp(row[name], match[1], match[2]));
  return rows;
}

function postgrest(url, options = {}) {
  const target = new URL(url);
  if (process.env.DEMO_LOG) console.log("[pg]", (options.method ?? "GET"), target.pathname + target.search.slice(0, 140));
  const parts = target.pathname.split("/").filter(Boolean);
  const table = parts[parts.length - 1];
  const rows = TABLES[table] ?? [];
  const method = options.method ?? "GET";
  if (method !== "GET") return Response.json([], { status: 201 });

  const search = target.searchParams;
  let out = rows.filter((row) => row.deleted_at === null);
  for (const [name, raw] of search) {
    if (["select", "order", "limit", "offset"].includes(name)) continue;
    if (name === "or" || name === "and") continue; // superset; JS mirror filters
    out = applyFilter(out, name, raw);
  }
  const order = search.get("order");
  if (order) {
    const keys = order.split(",").map((part) => {
      const [column, direction] = part.split(".");
      return { column, desc: direction === "desc" };
    });
    out = out.slice().sort((a, b) => {
      for (const { column, desc } of keys) {
        const av = a[column] ?? "";
        const bv = b[column] ?? "";
        if (av === bv) continue;
        return (av > bv ? 1 : -1) * (desc ? -1 : 1);
      }
      return 0;
    });
  }
  const range = (options.headers?.Range ?? options.headers?.range ?? "").match(/(\d+)-(\d+)/);
  if (range) {
    out = out.slice(Number(range[1]), Number(range[2]) + 1);
  } else if (search.get("limit")) {
    out = out.slice(0, Number(search.get("limit")));
  }
  return Response.json(out);
}

/* ------------------------------------------------------------- serve ---- */

const worker = createWorker({ fetchImpl: postgrest });
const env = {
  SUPABASE_URL: "http://demo.supabase.local",
  SUPABASE_PUBLISHABLE_KEY: "demo-publishable-key",
  EVIMESH_ENV: "development",
};

const server = createServer(async (req, res) => {
  const origin = "http://demo-api.local";
  const url = new URL(req.url ?? "/", origin);
  const body = await new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
  });
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method ?? "") ? undefined : body,
  });
  try {
    const response = await worker.fetch(request, env);
    const headers = { "access-control-allow-origin": "*" };
    for (const [name, value] of response.headers) {
      if (!["content-length", "transfer-encoding", "connection", "content-encoding"].includes(name.toLowerCase())) {
        headers[name] = value;
      }
    }
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
    }
    res.end(JSON.stringify({ error: String(error?.stack ?? error) }));
  }
});

const port = Number(process.env.DEMO_STACK_PORT ?? 8787);
server.listen(port, "127.0.0.1", () => {
  console.log(`demo api stack on http://127.0.0.1:${port}`);
});
