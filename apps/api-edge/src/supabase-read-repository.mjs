import { RESEARCH_EDGE_DEFINITIONS, RESEARCH_NODE_DEFINITIONS } from "../../../packages/protocol/src/research-graph.mjs";
import { challengeTransitionsFrom } from "../../../packages/protocol/src/challenge-state.mjs";

const TABLES = Object.freeze({
  actors: "actors",
  actorDirectory: "actor_directory",
  actorProfiles: "actor_profiles",
  apiTokens: "api_tokens",
  engagementInteractions: "engagement_interactions",
  identities: "identities",
  recommendationCache: "recommendation_cache",
  artifactLocations: "artifact_locations",
  artifactRevisions: "artifact_revisions",
  artifacts: "artifacts",
  attempts: "attempts",
  challengeImpacts: "challenge_impacts",
  challengeRevisions: "challenge_revisions",
  challenges: "challenges",
  claimRevisions: "claim_revisions",
  claims: "claims",
  contextBundles: "context_bundles",
  contributionEdges: "contribution_edges",
  contributionStatements: "contribution_statements",
  evidenceClaimLinks: "evidence_claim_links",
  evidence: "evidence",
  frontierMembers: "frontier_members",
  frontierSnapshots: "frontier_snapshots",
  merkleCheckpoints: "merkle_checkpoints",
  mergeProposals: "merge_proposals",
  projectRevisions: "project_revisions",
  projects: "projects",
  projectMembers: "project_members",
  questionRevisions: "question_revisions",
  questions: "questions",
  researchContractRevisions: "research_contract_revisions",
  researchEvents: "research_events",
  researchGraphNodes: "research_graph_nodes",
  researchGraphEdges: "research_graph_edges",
  researchGraphLegacyRelations: "research_graph_legacy_relations",
  researchAnswers: "research_answers",
  researchRebuttals: "research_rebuttals",
  researchEvaluations: "research_evaluations",
  researchEvaluationBases: "research_evaluation_bases",
  researchDatasets: "research_datasets",
  researchTools: "research_tools",
  signingKeys: "signing_keys",
  runInputs: "run_inputs",
  runOutputs: "run_outputs",
  runs: "runs",
  taskDependencies: "task_dependencies",
  taskLeases: "task_leases",
  taskRevisions: "task_revisions",
  tasks: "tasks",
  traceEvents: "trace_events",
  verificationFindings: "verification_findings",
  verificationReceipts: "verification_receipts",
  verificationContractRevisions: "verification_contract_revisions",
  claimRelations: "claim_relations",
});

export class SupabaseReadRepositoryError extends Error {
  constructor(message, code = "SUPABASE_READ_UNAVAILABLE", status = 503) {
    super(message);
    this.name = "SupabaseReadRepositoryError";
    this.code = code;
    this.status = status;
  }
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SupabaseReadRepositoryError(`${name} is required`, "SUPABASE_READ_CONFIGURATION_INVALID", 500);
  }
  return value.trim();
}

function camelCaseKey(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelCaseKey(key), value]));
}

const PAGE_SIZE = 1000;
const CLAIM_GRAPH_FRONTIER_BATCH_SIZE = 50;
const CLAIM_GRAPH_QUERY_CONCURRENCY = 4;
const CLAIM_GRAPH_MAX_NODES = 256;
const CLAIM_GRAPH_MAX_EDGES = 512;
const CLAIM_GRAPH_RELATION_QUERY_LIMIT = CLAIM_GRAPH_MAX_EDGES + 1;
const RESEARCH_GRAPH_MAX_NODES = 200;
const RESEARCH_GRAPH_MAX_EDGES = 400;
const RESEARCH_GRAPH_RELATION_QUERY_LIMIT = RESEARCH_GRAPH_MAX_EDGES + 1;
const ATTRIBUTION_BATCH_SIZE = 50;
const LEGACY_DUAL_WRITE_MUTATION_KINDS = new Set([
  "claim.create", "claim.revise", "claim.transition",
  "evidence.create", "evidence.link",
  "verification_receipt.submit",
  "challenge.create", "challenge.transition",
]);
const RESEARCH_GRAPH_RPC_BAD_REQUEST_CODES = new Set([
  "RESEARCH_GRAPH_DUAL_WRITE_INPUT_INVALID",
  "RESEARCH_GRAPH_DUAL_WRITE_KIND_INVALID",
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_COUNT",
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_INVALID",
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_PARENT_INVALID",
  "RESEARCH_GRAPH_DUAL_WRITE_NODE_INVALID",
  "RESEARCH_GRAPH_DUAL_WRITE_REVISION_INVALID",
]);
const RESEARCH_GRAPH_RPC_FORBIDDEN_CODES = new Set([
  "RESEARCH_GRAPH_DUAL_WRITE_FORBIDDEN",
  "RESEARCH_GRAPH_DUAL_WRITE_ROLE_MISMATCH",
  "RESEARCH_GRAPH_DUAL_WRITE_SERVICE_ROLE_REQUIRED",
]);
const RESEARCH_GRAPH_RPC_CONFLICT_CODES = new Set([
  "RESEARCH_GRAPH_DUAL_WRITE_CROSSWALK_CONFLICT",
  "RESEARCH_GRAPH_DUAL_WRITE_DANGLING",
  "RESEARCH_GRAPH_DUAL_WRITE_EDGE_CONFLICT",
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT",
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_MISMATCH",
  "RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT",
  "RESEARCH_GRAPH_DUAL_WRITE_MOTIF_CONFLICT",
  "RESEARCH_GRAPH_DUAL_WRITE_NODE_CONFLICT",
  "RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH",
  "RESEARCH_GRAPH_DUAL_WRITE_PROJECT_UNRESOLVED",
  "RESEARCH_GRAPH_DUAL_WRITE_REVISION_CONFLICT",
  "RESEARCH_GRAPH_DUAL_WRITE_REVISION_GAP",
  "RESEARCH_GRAPH_DUAL_WRITE_REVISION_RACE",
  "RESEARCH_GRAPH_DUAL_WRITE_STATE_INVALID",
]);
const QUESTION_EVENT_CLAIM_LIMIT = 50;
/* Attribution views render a bounded list; one object carrying more edges
 * than this is a data anomaly, not a page the UI could show. */
const CONTRIBUTION_EDGES_OBJECT_LIMIT = 64;
const EVENT_ACTOR_PAYLOAD_KEYS = Object.freeze(["actor_id", "signer_actor_id", "publisher_actor_id", "drafted_by_actor_id", "producer_actor_id", "run_actor_id"]);
const ACTOR_PUBLIC_SELECT = [
  "actor_id",
  "actor_type",
  "identity_strength",
  "model_name",
  "runtime",
  "scope",
  "public_key_fingerprint",
  "owner_actor_id",
  "created_at",
  "updated_at",
].join(",");
const TABLE_ORDERS = Object.freeze({
  actors: "created_at.desc,actor_id.desc",
  actorDirectory: "created_at.desc,actor_id.desc",
  actorProfiles: "actor_id.asc",
  apiTokens: "created_at.desc,token_id.desc",
  engagementInteractions: "created_at.desc,interaction_id.desc",
  identities: "created_at.desc,identity_id.desc",
  recommendationCache: "rank.asc,object_type.asc,object_id.asc",
  artifactLocations: "created_at.asc,location_id.asc",
  artifactRevisions: "revision.desc,artifact_id.desc",
  artifacts: "created_at.desc,artifact_id.desc",
  attempts: "started_at.desc,attempt_id.desc",
  challengeImpacts: "created_at.asc,impact_id.asc",
  challengeRevisions: "revision.desc,challenge_id.desc",
  challenges: "created_at.desc,challenge_id.desc",
  claimRevisions: "revision.desc,claim_id.desc",
  claims: "created_at.desc,claim_id.desc",
  claimRelations: "created_at.asc,source_claim_id.asc,target_claim_id.asc,relation_type.asc",
  contextBundles: "created_at.desc,context_bundle_id.desc",
  contributionEdges: "statement_id.asc,edge_type.asc",
  contributionStatements: "created_at.desc,statement_id.desc",
  evidenceClaimLinks: "created_at.asc,evidence_id.asc",
  evidence: "created_at.desc,evidence_id.desc",
  frontierMembers: "claim_id.asc",
  frontierSnapshots: "sequence.desc,snapshot_id.desc",
  merkleCheckpoints: "created_at.desc,checkpoint_id.desc",
  mergeProposals: "created_at.desc,proposal_id.desc",
  projectRevisions: "revision.desc,project_id.desc",
  projects: "created_at.desc,project_id.desc",
  projectMembers: "project_id.asc,actor_id.asc",
  questionRevisions: "revision.desc,question_id.desc",
  questions: "created_at.desc,question_id.desc",
  researchContractRevisions: "revision.desc,contract_id.desc",
  researchEvents: "created_at.asc,event_id.asc",
  researchGraphNodes: "commit_rank.asc,batch_rank.asc,node_kind.asc,node_id.asc,revision.asc",
  researchGraphEdges: "created_at.asc,edge_id.asc",
  researchGraphLegacyRelations: "mapping_id.asc",
  researchAnswers: "created_at.desc,answer_id.desc,revision.desc",
  researchRebuttals: "created_at.desc,rebuttal_id.desc,revision.desc",
  researchEvaluations: "created_at.desc,evaluation_id.desc,revision.desc",
  researchEvaluationBases: "evaluation_id.asc,evaluation_revision.asc,basis_kind.asc,basis_id.asc,basis_revision.asc",
  researchDatasets: "created_at.desc,dataset_id.desc,revision.desc",
  researchTools: "created_at.desc,tool_id.desc,revision.desc",
  signingKeys: "created_at.desc,key_id.desc",
  runInputs: "created_at.asc,artifact_id.asc",
  runOutputs: "created_at.asc,artifact_id.asc",
  runs: "started_at.desc,run_id.desc",
  taskDependencies: "source_task_id.asc",
  taskLeases: "expires_at.desc",
  taskRevisions: "revision.desc,task_id.desc",
  tasks: "created_at.desc,task_id.desc",
  traceEvents: "created_at.asc,event_id.asc",
  verificationFindings: "severity.desc,code.asc",
  verificationReceipts: "created_at.desc,receipt_id.desc",
  verificationContractRevisions: "contract_id.asc,revision.desc",
});

/** PostgREST filter value: `eq.x` for scalars, `in.(a,b)` for arrays, and
 *  `{ op, value }` for explicit operators (gte/lte/gt/lt/like/ilike). */
function filterValue(value) {
  if (Array.isArray(value)) return `in.(${value.map(postgrestLogicLiteral).join(",")})`;
  if (value && typeof value === "object" && typeof value.op === "string") return `${value.op}.${value.value}`;
  return `eq.${value}`;
}

function postgrestLogicLiteral(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function eventActorPredicate(actorId) {
  const literal = postgrestLogicLiteral(actorId);
  return EVENT_ACTOR_PAYLOAD_KEYS.map((key) => `payload->>${key}.eq.${literal}`).join(",");
}

function eventObjectIdKeys(objectType) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(objectType)) return [];
  const keys = [`${objectType}_id`];
  if (objectType === "claim") keys.push("source_claim_id", "target_claim_id");
  if (objectType === "task") keys.push("source_task_id", "target_task_id");
  if (objectType === "verification" || objectType === "verification_receipt") keys.push("receipt_id");
  if (objectType === "frontier" || objectType === "frontier_snapshot") keys.push("snapshot_id", "frontier_snapshot_id");
  if (objectType === "merge_proposal") keys.push("proposal_id");
  return keys;
}

function eventObjectPredicate(objectType, objectId, descendantClaimIds = []) {
  const typeLiteral = postgrestLogicLiteral(objectType);
  const idLiteral = postgrestLogicLiteral(objectId);
  const typedKeys = eventObjectIdKeys(objectType);
  const predicates = [
    `and(or(payload->>object_type.eq.${typeLiteral},payload->>entity_type.eq.${typeLiteral}),payload->>object_id.eq.${idLiteral})`,
  ];
  predicates.unshift(...typedKeys.map((key) => `payload->>${key}.eq.${idLiteral}`));
  if (objectType === "question") {
    predicates.unshift(`payload->projection->state->claim->>questionId.eq.${idLiteral}`);
    if (descendantClaimIds.length > 0) {
      const membership = filterValue(descendantClaimIds);
      predicates.unshift(`payload->>claim_id.${membership}`, `payload->>source_claim_id.${membership}`, `payload->>target_claim_id.${membership}`);
    }
  }
  return predicates.join(",");
}

/* PostgREST predicates compare payload fields as text (payload->>); the JS
 * mirrors of those predicates must use the same text semantics, or rows the
 * API already matched get silently dropped from a fetched page. */
function payloadTextEquals(value, expected) {
  if (value === null || value === undefined || typeof value === "object") return false;
  return String(value) === expected;
}

function eventReferencesObject(payload, objectType, objectId, descendantClaimIds = new Set()) {
  const typedReference = eventObjectIdKeys(objectType).some((key) => payloadTextEquals(payload[key], objectId));
  const descendantReference = objectType === "question"
    && (payloadTextEquals(payload.projection?.state?.claim?.questionId, objectId)
      || [payload.claim_id, payload.source_claim_id, payload.target_claim_id].some((claimId) => {
        if (claimId === null || claimId === undefined || typeof claimId === "object") return false;
        return descendantClaimIds.has(String(claimId));
      }));
  const genericReference = (payloadTextEquals(payload.object_type, objectType) || payloadTextEquals(payload.entity_type, objectType))
    && payloadTextEquals(payload.object_id, objectId);
  return typedReference || descendantReference || genericReference;
}

/* Only mutable-projection tables carry lifecycle columns; the soft-delete
 * filter must not be applied to revision, event, or junction fact tables. */
const SOFT_DELETE_TABLES = new Set(["actors", "actorProfiles", "artifacts", "attempts", "challenges", "claimRelations", "claims", "identities", "projectMembers", "projects", "questions", "signingKeys"]);

/* Interaction target tables: id columns differ per object type. */
const INTERACTION_TARGET_SPECS = Object.freeze({
  question: { table: "questions", idColumn: "question_id" },
  claim: { table: "claims", idColumn: "claim_id" },
  task: { table: "tasks", idColumn: "task_id" },
  project: { table: "projects", idColumn: "project_id" },
});

export function createSupabaseReadRepository({ url, publishableKey, serviceRoleKey = null, fetchImpl = fetch } = {}) {
  const baseUrl = requiredString(url, "Supabase URL").replace(/\/$/, "");
  const apiKey = requiredString(publishableKey, "Supabase publishable key");
  const graphServiceKey = typeof serviceRoleKey === "string" && serviceRoleKey.trim() ? serviceRoleKey.trim() : null;
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  /* Supabase's current sb_secret_* keys are opaque API keys, not JWTs. Sending
   * one as a Bearer credential is rejected as an invalid JWT. Legacy
   * service_role keys are JWTs and retain the Authorization header so local
   * and older hosted gateways continue to derive the service role. */
  function serviceAccessOptions() {
    if (!graphServiceKey) return null;
    return {
      requestApiKey: graphServiceKey,
      ...(!graphServiceKey.startsWith("sb_secret_") ? { authorizationToken: graphServiceKey } : {}),
    };
  }

  function serviceHeaders(extra = {}) {
    const headers = { ...extra, apikey: graphServiceKey };
    if (!graphServiceKey.startsWith("sb_secret_")) headers.authorization = `Bearer ${graphServiceKey}`;
    return headers;
  }

  async function query(table, { filters = {}, order = null, limit = null, select = "*", authorizationToken = null, requestApiKey = apiKey } = {}) {
    const endpoint = new URL(`${baseUrl}/rest/v1/${TABLES[table]}`);
    endpoint.searchParams.set("select", select);
    if (SOFT_DELETE_TABLES.has(table)) endpoint.searchParams.set("deleted_at", "is.null");
    endpoint.searchParams.set("order", order ?? TABLE_ORDERS[table]);
    if (Number.isInteger(limit) && limit > 0) endpoint.searchParams.set("limit", String(limit));
    for (const [column, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;
      if (column === "and" || column === "or") endpoint.searchParams.set(column, String(value));
      else endpoint.searchParams.set(column, filterValue(value));
    }

    const rows = [];
    const requestPageSize = Number.isInteger(limit) && limit > 0 ? Math.min(limit, PAGE_SIZE) : PAGE_SIZE;
    for (let offset = 0; ; offset += requestPageSize) {
      let response;
      try {
        const headers = { accept: "application/json", apikey: requestApiKey, Range: `${offset}-${offset + requestPageSize - 1}`, "Range-Unit": "items" };
        if (authorizationToken) headers.authorization = `Bearer ${authorizationToken}`;
        response = await fetchImpl(endpoint, { headers });
      } catch {
        throw new SupabaseReadRepositoryError("Supabase Data API request failed");
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = typeof payload === "object" && payload ? ` (${JSON.stringify(payload).slice(0, 512)})` : "";
        throw new SupabaseReadRepositoryError(`Supabase Data API request failed with ${response.status}${detail}`);
      }
      if (!Array.isArray(payload)) throw new SupabaseReadRepositoryError("Supabase Data API returned an invalid response");
      rows.push(...payload.map(mapRow));
      if (payload.length < requestPageSize || (Number.isInteger(limit) && limit > 0)) return rows;
    }
  }

  async function list(table, filters = {}) {
    return query(table, { filters });
  }

  async function listByIdsInBatches(table, column, values) {
    const ids = [...new Set(Array.isArray(values) ? values : [])];
    const batches = [];
    for (let offset = 0; offset < ids.length; offset += ATTRIBUTION_BATCH_SIZE) {
      batches.push(ids.slice(offset, offset + ATTRIBUTION_BATCH_SIZE));
    }
    return (await Promise.all(batches.map((batch) => list(table, { [column]: batch })))).flat();
  }

  async function getOne(table, filters) {
    return (await query(table, { filters, limit: 1 }))[0] ?? null;
  }

  async function getPublicActor(actorId) {
    return (await query("actorDirectory", {
      filters: { actor_id: actorId },
      limit: 1,
      select: ACTOR_PUBLIC_SELECT,
    }))[0] ?? null;
  }

  async function currentRevision(table, idColumn, id) {
    return (await query(table, { filters: { [idColumn]: id }, order: `${TABLE_ORDERS[table].split(",")[0]},${idColumn}.desc`, limit: 1 }))[0] ?? null;
  }

  function questionIdsForProject(projectId) {
    if (projectId === null) return null;
    return list("questions", { project_id: projectId }).then((rows) => new Set(rows.map((question) => question.questionId)));
  }

  function unsupportedFilter(name) {
    throw new SupabaseReadRepositoryError(`${name} filtering is not available in the hosted discovery read model`, "SUPABASE_READ_FILTER_UNSUPPORTED", 400);
  }

  /** PostgREST call forwarding the caller's Supabase JWT: row ownership is
   *  pinned by RLS policies seeing the authenticated role, not by this code. */
  async function authedRequest(table, { accessToken, method = "GET", body = null, params = {}, prefer = null } = {}) {
    const endpoint = new URL(`${baseUrl}/rest/v1/${TABLES[table]}`);
    for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, String(value));
    const headers = { accept: "application/json", apikey: apiKey, authorization: `Bearer ${requiredString(accessToken, "Supabase access token")}` };
    if (body !== null) headers["content-type"] = "application/json";
    if (prefer) headers.prefer = prefer;
    let response;
    try {
      response = await fetchImpl(endpoint, { method, headers, body: body === null ? undefined : JSON.stringify(body) });
    } catch {
      throw new SupabaseReadRepositoryError("Supabase Data API request failed");
    }
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = null; }
    }
    return { ok: response.ok, status: response.status, payload };
  }

  async function serviceRpc(name, body) {
    if (!graphServiceKey) {
      throw new SupabaseReadRepositoryError(
        "research graph transactional RPC requires the server-side service credential",
        "SUPABASE_GRAPH_DUAL_WRITE_UNAVAILABLE",
        503,
      );
    }
    const endpoint = new URL(`${baseUrl}/rest/v1/rpc/${name}`);
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: serviceHeaders({
          accept: "application/json",
          "content-type": "application/json",
        }),
        body: JSON.stringify(body),
      });
    } catch {
      throw new SupabaseReadRepositoryError("Supabase research graph RPC request failed", "SUPABASE_GRAPH_DUAL_WRITE_FAILED", 503);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : "";
      const guard = /^\[([A-Z0-9_]+)\]\s*(.*)$/.exec(message);
      const guardCode = guard?.[1] ?? null;
      const guardStatus = RESEARCH_GRAPH_RPC_BAD_REQUEST_CODES.has(guardCode) ? 400
        : RESEARCH_GRAPH_RPC_FORBIDDEN_CODES.has(guardCode) ? 403
          : RESEARCH_GRAPH_RPC_CONFLICT_CODES.has(guardCode) ? 409 : null;
      if (guardStatus !== null) {
        throw new SupabaseReadRepositoryError(guard[2] || "research graph dual write rejected", guardCode, guardStatus);
      }
      const detail = payload && typeof payload === "object" ? ` (${JSON.stringify(payload).slice(0, 512)})` : "";
      throw new SupabaseReadRepositoryError(
        `Supabase research graph RPC failed with ${response.status}${detail}`,
        "SUPABASE_GRAPH_DUAL_WRITE_FAILED",
        response.status === 409 ? 409 : 502,
      );
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.parity !== true
      || !Object.hasOwn(payload, "legacy") || !Object.hasOwn(payload, "kernel")) {
      throw new SupabaseReadRepositoryError("Supabase research graph RPC returned no verified parity result", "SUPABASE_GRAPH_DUAL_WRITE_MISMATCH", 409);
    }
    return payload;
  }

  function authedFailure(result, code) {
    const detail = result.payload ? ` (${JSON.stringify(result.payload).slice(0, 256)})` : "";
    return new SupabaseReadRepositoryError(`Supabase Data API request failed with ${result.status}${detail}`, code, 502);
  }

  /* Relations whose target is the source's prerequisite, origin, or prior
   * context. For the remaining assertion/assessment relations, the source is
   * the upstream context of the target. Protocol source/target is never
   * rewritten; this map only controls reader traversal. */
  const TARGET_IS_UPSTREAM = new Set([
    "depends_on",
    "reproduces",
    "extends",
    "supersedes",
    "derived_from",
    "uses_method",
    "uses_dataset",
    "implements",
  ]);

  function traversalEndpoints(relation, direction) {
    const targetIsUpstream = TARGET_IS_UPSTREAM.has(relation.relationType);
    const upstreamFrom = targetIsUpstream ? relation.sourceClaimId : relation.targetClaimId;
    const upstreamTo = targetIsUpstream ? relation.targetClaimId : relation.sourceClaimId;
    return direction === "upstream"
      ? { from: upstreamFrom, to: upstreamTo }
      : { from: upstreamTo, to: upstreamFrom };
  }

  function hasGraphPath(adjacency, from, target, seen = new Set()) {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return [...(adjacency.get(from) ?? [])].some((next) => hasGraphPath(adjacency, next, target, seen));
  }

  async function claimGraph({ claimId, maxDepth, direction }) {
    const visited = new Set([claimId]);
    let frontier = [{ claimId, depth: 0, path: [claimId] }];
    const nodes = [];
    const edges = [];
    const edgeAdjacency = new Map();
    let truncated = false;
    while (frontier.length > 0 && frontier[0].depth < maxDepth) {
      /* Query each breadth-first frontier in bounded parallel batches. This
       * keeps request URLs bounded without issuing one serial round trip per
       * Claim. A relation spanning two batches is deduplicated below. */
      const batches = [];
      for (let offset = 0; offset < frontier.length; offset += CLAIM_GRAPH_FRONTIER_BATCH_SIZE) {
        batches.push(frontier.slice(offset, offset + CLAIM_GRAPH_FRONTIER_BATCH_SIZE).map((node) => node.claimId));
      }
      const relationPages = await mapWithConcurrency(batches, CLAIM_GRAPH_QUERY_CONCURRENCY, (claimIds) => {
        const membership = filterValue(claimIds);
        return query("claimRelations", {
          filters: { or: `(source_claim_id.${membership},target_claim_id.${membership})` },
          limit: CLAIM_GRAPH_RELATION_QUERY_LIMIT,
        });
      });
      if (relationPages.some((page) => page.length >= CLAIM_GRAPH_RELATION_QUERY_LIMIT)) truncated = true;
      const incidentRows = relationPages.flatMap((page) => page.slice(0, CLAIM_GRAPH_MAX_EDGES));
      const incident = [...new Map(incidentRows.map((relation) => [
        `${relation.sourceClaimId}\u0000${relation.targetClaimId}\u0000${relation.relationType}`,
        relation,
      ])).values()];
      const nextFrontier = [];
      let budgetExhausted = false;
      traversal: for (const current of frontier) {
        for (const relation of incident) {
          const { from, to: nextId } = traversalEndpoints(relation, direction);
          if (from !== current.claimId) continue;
          if (hasGraphPath(edgeAdjacency, relation.targetClaimId, relation.sourceClaimId)) continue;
          if (edges.length >= CLAIM_GRAPH_MAX_EDGES || (!visited.has(nextId) && nodes.length >= CLAIM_GRAPH_MAX_NODES)) {
            truncated = true;
            budgetExhausted = true;
            break traversal;
          }
          edges.push({
            sourceClaimId: relation.sourceClaimId,
            targetClaimId: relation.targetClaimId,
            relationType: relation.relationType,
            depth: current.depth + 1,
            path: [...current.path, nextId],
          });
          const targets = edgeAdjacency.get(relation.sourceClaimId) ?? new Set();
          targets.add(relation.targetClaimId);
          edgeAdjacency.set(relation.sourceClaimId, targets);
          if (visited.has(nextId)) continue;
          visited.add(nextId);
          const next = { claimId: nextId, depth: current.depth + 1, path: [...current.path, nextId] };
          nextFrontier.push(next);
          nodes.push(next);
        }
      }
      frontier = budgetExhausted ? [] : nextFrontier;
    }
    const claimIdBatches = [];
    for (let offset = 0; offset < nodes.length; offset += CLAIM_GRAPH_FRONTIER_BATCH_SIZE) {
      claimIdBatches.push(nodes.slice(offset, offset + CLAIM_GRAPH_FRONTIER_BATCH_SIZE).map((node) => node.claimId));
    }
    const claims = (await mapWithConcurrency(claimIdBatches, CLAIM_GRAPH_QUERY_CONCURRENCY, (claimIds) => list("claims", { claim_id: claimIds }))).flat();
    const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
    return { nodes: nodes.map((node) => ({ ...(claimById.get(node.claimId) ?? {}), ...node })), edges, truncated };
  }

  function researchRefKey(ref) {
    return `${ref.kind}:${ref.id}@${ref.revision}`;
  }

  function graphCursorFingerprint({ root, direction, depth, nodeKinds, edgeTypes }) {
    return JSON.stringify({ root, direction, depth, nodeKinds: [...nodeKinds].sort(), edgeTypes: [...edgeTypes].sort() });
  }

  function decodeGraphCursor(cursor, queryFingerprint) {
    if (cursor === null || cursor === undefined) return { edgeOffset: 0, graphWatermark: null };
    try {
      const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (value?.version !== 1 || value.query !== queryFingerprint || !Number.isSafeInteger(value.edgeOffset) || value.edgeOffset < 0 || value.edgeOffset > 4000 || typeof value.graphWatermark !== "string") throw new Error("invalid cursor");
      return { edgeOffset: value.edgeOffset, graphWatermark: value.graphWatermark };
    } catch {
      throw new SupabaseReadRepositoryError("research graph cursor is invalid or belongs to another query", "SUPABASE_GRAPH_CURSOR_INVALID", 400);
    }
  }

  function encodeGraphCursor({ queryFingerprint, edgeOffset, graphWatermark }) {
    return Buffer.from(JSON.stringify({ version: 1, query: queryFingerprint, edgeOffset, graphWatermark }), "utf8").toString("base64url");
  }

  function rowRef(row) {
    return { kind: row.nodeKind, id: row.nodeId, revision: Number(row.revision) };
  }

  function edgeEndpoint(row, side) {
    return { kind: row[`${side}Kind`], id: row[`${side}Id`], revision: Number(row[`${side}Revision`]) };
  }

  async function scopedResearchAccess(accessToken, actorId) {
    const callerToken = typeof accessToken === "string" && accessToken.trim() ? accessToken.trim() : null;
    const usesApiTokenBridge = callerToken?.startsWith("evimesh_") === true;
    if (usesApiTokenBridge && (!graphServiceKey || typeof actorId !== "string" || !actorId.trim())) {
      throw new SupabaseReadRepositoryError("API-token research reads require the server-side membership bridge", "SUPABASE_GRAPH_API_TOKEN_BRIDGE_UNAVAILABLE", 503);
    }
    const serviceAccess = serviceAccessOptions();
    const callerAccess = usesApiTokenBridge
      ? serviceAccess
      : callerToken ? { authorizationToken: callerToken, requestApiKey: apiKey } : {};
    const auditAccess = serviceAccess;
    let memberProjects = null;
    let accessibleProjects = null;
    if (usesApiTokenBridge) {
      const [memberships, publicProjects] = await Promise.all([
        query("projectMembers", { filters: { actor_id: actorId.trim() }, ...auditAccess }),
        query("projects", { filters: { state: "active" }, ...auditAccess }),
      ]);
      memberProjects = new Set(memberships.map((membership) => membership.projectId));
      accessibleProjects = new Set([...memberProjects, ...publicProjects.map((project) => project.projectId)]);
    }
    return Object.freeze({
      callerToken,
      usesApiTokenBridge,
      callerAccess,
      auditAccess,
      memberProjects,
      accessibleProjects,
      rowAllowed: (row) => accessibleProjects === null || accessibleProjects.has(row.projectId),
    });
  }

  async function exactResearchRows(refs, access, rowAllowed = () => true) {
    const values = [...new Map(refs.map((ref) => [researchRefKey(ref), ref])).values()];
    const wanted = new Set(values.map(researchRefKey));
    const batches = [];
    for (let offset = 0; offset < values.length; offset += ATTRIBUTION_BATCH_SIZE) {
      batches.push(values.slice(offset, offset + ATTRIBUTION_BATCH_SIZE).map((ref) => ref.id));
    }
    const rows = (await Promise.all(batches.map((ids) => query("researchGraphNodes", { filters: { node_id: ids }, ...access })))).flat();
    return rows.filter((row) => wanted.has(researchRefKey(rowRef(row))) && rowAllowed(row));
  }

  async function researchNeighborhood({ root, direction, depth, nodeKinds = [], edgeTypes = [], nodeLimit = RESEARCH_GRAPH_MAX_NODES, edgeLimit = RESEARCH_GRAPH_MAX_EDGES, cursor = null, accessToken = null, actorId = null } = {}) {
    const queryFingerprint = graphCursorFingerprint({ root, direction, depth, nodeKinds, edgeTypes });
    const cursorState = decodeGraphCursor(cursor, queryFingerprint);
    const traversalNodeLimit = Math.min(4000, Math.max(nodeLimit, nodeLimit + (cursorState.edgeOffset * 2)));
    const traversalEdgeLimit = Math.min(4000, Math.max(edgeLimit, edgeLimit + cursorState.edgeOffset));
    const relationQueryLimit = traversalEdgeLimit + 1;
    const { callerToken, usesApiTokenBridge, callerAccess, auditAccess, accessibleProjects, rowAllowed } = await scopedResearchAccess(accessToken, actorId);
    const exactRows = (refs, access = callerAccess) => exactResearchRows(refs, access, rowAllowed);
    const rootFilters = { node_kind: root.kind, node_id: root.id, ...(root.revision ? { revision: root.revision } : { is_current: true }) };
    const rootRow = (await query("researchGraphNodes", { filters: rootFilters, limit: 1, ...callerAccess }))[0] ?? null;
    if (!rootRow || !rowAllowed(rootRow)) return null;
    const resolvedRoot = rowRef(rootRow);
    const nodeRefs = new Map([[researchRefKey(resolvedRoot), resolvedRoot]]);
    const rowByRef = new Map([[researchRefKey(resolvedRoot), rootRow]]);
    const edgeRows = new Map();
    let frontier = [resolvedRoot];
    let truncated = false;
    /* Without a service-side comparison the caller-RLS view is safe, but the
     * API cannot prove that no hidden connection exists. Complete topology is
     * therefore claimed only when the audit path confirms it. */
    let permissionPartial = callerToken === null || !auditAccess;
    for (let level = 0; level < depth && frontier.length > 0; level += 1) {
      const ids = [...new Set(frontier.map((ref) => ref.id))];
      const membership = filterValue(ids);
      const filters = {
        or: direction === "upstream"
          ? `(target_id.${membership})`
          : direction === "downstream" ? `(source_id.${membership})` : `(source_id.${membership},target_id.${membership})`,
        ...(edgeTypes.length > 0 ? { edge_type: edgeTypes } : {}),
      };
      const pages = await query("researchGraphEdges", { filters, limit: relationQueryLimit, ...callerAccess });
      if (pages.length > traversalEdgeLimit) truncated = true;
      const frontierKeys = new Set(frontier.map(researchRefKey));
      const incident = (rows) => rows.flatMap((row) => {
        const source = edgeEndpoint(row, "source");
        const target = edgeEndpoint(row, "target");
        const sourceMatch = frontierKeys.has(researchRefKey(source));
        const targetMatch = frontierKeys.has(researchRefKey(target));
        if (direction === "upstream" && !targetMatch) return [];
        if (direction === "downstream" && !sourceMatch) return [];
        if (direction === "both" && !sourceMatch && !targetMatch) return [];
        const discovered = direction === "upstream" ? source : direction === "downstream" ? target : sourceMatch ? target : source;
        if (nodeKinds.length > 0 && !nodeKinds.includes(discovered.kind)) return [];
        return [{ row, discovered }];
      });
      const visibleIncident = incident(pages.slice(0, traversalEdgeLimit));
      if (callerToken !== null && !usesApiTokenBridge && auditAccess) {
        const auditPages = await query("researchGraphEdges", { filters, limit: relationQueryLimit, ...auditAccess });
        const visibleIds = new Set(visibleIncident.map(({ row }) => row.edgeId));
        if (incident(auditPages.slice(0, traversalEdgeLimit)).some(({ row }) => !visibleIds.has(row.edgeId))) {
          permissionPartial = true;
        }
      }
      const candidateRefs = visibleIncident.map(({ discovered }) => discovered);
      const candidateRows = await exactRows(candidateRefs);
      const visibleCandidates = new Map(candidateRows.map((row) => [researchRefKey(rowRef(row)), row]));
      const next = [];
      for (const { row, discovered } of visibleIncident) {
        const discoveredKey = researchRefKey(discovered);
        const discoveredRow = visibleCandidates.get(discoveredKey);
        if (!discoveredRow) { permissionPartial = true; continue; }
        if (!nodeRefs.has(discoveredKey) && nodeRefs.size >= traversalNodeLimit) { truncated = true; continue; }
        if (!edgeRows.has(row.edgeId) && edgeRows.size >= traversalEdgeLimit) { truncated = true; continue; }
        edgeRows.set(row.edgeId, row);
        if (!nodeRefs.has(discoveredKey)) {
          nodeRefs.set(discoveredKey, discovered);
          rowByRef.set(discoveredKey, discoveredRow);
          next.push(discovered);
        }
      }
      frontier = next;
    }
    const refValues = [...nodeRefs.values()];
    const nodes = refValues.map((ref) => {
      const row = rowByRef.get(researchRefKey(ref));
      const definition = RESEARCH_NODE_DEFINITIONS[ref.kind];
      return {
        ref,
        label: row.label,
        family: definition.family,
        state: row.state,
        canonicalHref: row.canonicalHref,
        createdAt: row.createdAt,
        createdBy: row.createdBy,
        isCurrent: Boolean(row.isCurrent),
      };
    });
    const visible = new Set(nodes.map((node) => researchRefKey(node.ref)));
    const edges = [...edgeRows.values()].filter((row) => visible.has(researchRefKey(edgeEndpoint(row, "source"))) && visible.has(researchRefKey(edgeEndpoint(row, "target")))).map((row) => {
      const definition = RESEARCH_EDGE_DEFINITIONS[row.edgeType];
      return {
        id: row.edgeId,
        type: row.edgeType,
        family: definition.family,
        source: edgeEndpoint(row, "source"),
        target: edgeEndpoint(row, "target"),
        forwardLabel: definition.forwardLabel,
        reverseLabel: definition.reverseLabel,
        provenanceEventId: row.provenanceEventId,
      };
    });
    const watermarkRows = await query("researchGraphNodes", {
      filters: usesApiTokenBridge && accessibleProjects?.size ? { project_id: [...accessibleProjects] } : {},
      order: "commit_rank.desc,batch_rank.desc,node_kind.desc,node_id.desc,revision.desc",
      limit: 1,
      ...callerAccess,
    });
    const watermarkRow = watermarkRows.find(rowAllowed) ?? rootRow;
    const graphWatermark = `${Number(watermarkRow.commitRank)}:${Number(watermarkRow.batchRank)}`;
    if (cursorState.graphWatermark !== null && cursorState.graphWatermark !== graphWatermark) {
      throw new SupabaseReadRepositoryError("research graph changed after the cursor was issued", "SUPABASE_GRAPH_CURSOR_STALE", 409);
    }
    const selectedNodeKeys = new Set([researchRefKey(resolvedRoot)]);
    const selectedEdges = [];
    let nextEdgeOffset = cursorState.edgeOffset;
    for (let index = cursorState.edgeOffset; index < edges.length && selectedEdges.length < edgeLimit; index += 1) {
      const edge = edges[index];
      const candidateKeys = [researchRefKey(edge.source), researchRefKey(edge.target)];
      const additions = candidateKeys.filter((key) => !selectedNodeKeys.has(key));
      if (selectedNodeKeys.size + additions.length > nodeLimit) break;
      for (const key of candidateKeys) selectedNodeKeys.add(key);
      selectedEdges.push(edge);
      nextEdgeOffset = index + 1;
    }
    const pageNodes = nodes.filter((node) => selectedNodeKeys.has(researchRefKey(node.ref)));
    const hasMore = nextEdgeOffset < edges.length || truncated;
    const nextCursor = hasMore ? encodeGraphCursor({ queryFingerprint, edgeOffset: nextEdgeOffset, graphWatermark }) : null;
    return {
      resolvedRoot,
      nodes: pageNodes,
      edges: selectedEdges,
      truncated: hasMore,
      permissionPartial,
      nextCursor,
      graphWatermark,
    };
  }

  function legacyPayloadField(payload, camel, snake, fallback = null) {
    return payload?.[camel] ?? payload?.[snake] ?? fallback;
  }

  function normalizeLegacyClaimRelation(mapping) {
    const payload = mapping?.sourcePayload ?? {};
    const sourceClaimId = legacyPayloadField(payload, "sourceClaimId", "source_claim_id");
    const targetClaimId = legacyPayloadField(payload, "targetClaimId", "target_claim_id");
    const relationType = legacyPayloadField(payload, "relationType", "relation_type");
    if (![sourceClaimId, targetClaimId, relationType].every((value) => typeof value === "string" && value)) return null;
    return {
      ...payload,
      sourceClaimId,
      sourceRevision: Number(legacyPayloadField(payload, "sourceRevision", "source_revision", 1)),
      targetClaimId,
      targetRevision: Number(legacyPayloadField(payload, "targetRevision", "target_revision", 1)),
      relationType,
    };
  }

  function normalizeLegacyEvidenceLink(mapping) {
    const payload = mapping?.sourcePayload ?? {};
    const evidenceId = legacyPayloadField(payload, "evidenceId", "evidence_id");
    const claimId = legacyPayloadField(payload, "claimId", "claim_id");
    const relationType = legacyPayloadField(payload, "relationType", "relation_type");
    if (![evidenceId, claimId, relationType].every((value) => typeof value === "string" && value)) return null;
    return {
      ...payload,
      evidenceId,
      claimId,
      claimRevision: Number(legacyPayloadField(payload, "claimRevision", "claim_revision", 1)),
      relationType,
    };
  }

  function legacyMappingEndpointRefs(mapping) {
    const payload = mapping?.sourcePayload ?? {};
    if (mapping?.source === "claim_relation") {
      const sourceId = legacyPayloadField(payload, "sourceClaimId", "source_claim_id");
      const targetId = legacyPayloadField(payload, "targetClaimId", "target_claim_id");
      if (!sourceId || !targetId) return null;
      const sourceRevision = legacyPayloadField(payload, "sourceRevision", "source_revision");
      const targetRevision = legacyPayloadField(payload, "targetRevision", "target_revision");
      return [
        { kind: "claim", id: sourceId, revision: Number.isInteger(Number(sourceRevision)) && Number(sourceRevision) > 0 ? Number(sourceRevision) : null },
        { kind: "claim", id: targetId, revision: Number.isInteger(Number(targetRevision)) && Number(targetRevision) > 0 ? Number(targetRevision) : null },
      ];
    }
    if (mapping?.source === "evidence_claim_link") {
      const evidenceId = legacyPayloadField(payload, "evidenceId", "evidence_id");
      const claimId = legacyPayloadField(payload, "claimId", "claim_id");
      const claimRevision = Number(legacyPayloadField(payload, "claimRevision", "claim_revision"));
      if (!evidenceId || !claimId || !Number.isInteger(claimRevision) || claimRevision < 1) return null;
      return [
        { kind: "evidence", id: evidenceId, revision: 1 },
        { kind: "claim", id: claimId, revision: claimRevision },
      ];
    }
    if (mapping?.source === "challenge_impact") {
      const challengeId = legacyPayloadField(payload, "challengeId", "challenge_id");
      const challengeRevision = Number(legacyPayloadField(payload, "challengeRevision", "challenge_revision"));
      const claimId = legacyPayloadField(payload, "claimId", "claim_id");
      const claimRevision = Number(legacyPayloadField(payload, "claimRevision", "claim_revision"));
      if (!challengeId || !claimId || !Number.isInteger(challengeRevision) || challengeRevision < 1 || !Number.isInteger(claimRevision) || claimRevision < 1) return null;
      return [
        { kind: "challenge", id: challengeId, revision: challengeRevision },
        { kind: "claim", id: claimId, revision: claimRevision },
      ];
    }
    return null;
  }

  function visibleLegacyMappingEndpoint(ref, visibleRefs) {
    return visibleRefs.some((candidate) => candidate.kind === ref.kind && candidate.id === ref.id
      && (ref.revision === null || Number(candidate.revision) === ref.revision));
  }

  async function legacyMappingsForNeighborhood(graph, sources) {
    if (!graphServiceKey) throw new SupabaseReadRepositoryError("kernel compatibility reads require the server-only legacy crosswalk", "SUPABASE_GRAPH_CROSSWALK_UNAVAILABLE", 503);
    const serviceAccess = serviceAccessOptions();
    const visibleEdges = new Set((graph?.edges ?? []).map((item) => item.id));
    const visibleNodes = new Set((graph?.nodes ?? []).map((item) => researchRefKey(item.ref)));
    const edgeIds = [...visibleEdges];
    const nodeIds = [...new Set((graph?.nodes ?? []).filter((item) => ["evaluation", "rebuttal", "challenge"].includes(item.ref.kind)).map((item) => item.ref.id))];
    const pages = [];
    for (let offset = 0; offset < edgeIds.length; offset += ATTRIBUTION_BATCH_SIZE) {
      pages.push(query("researchGraphLegacyRelations", { filters: { source: sources, status: "mapped", mapped_edge_id: edgeIds.slice(offset, offset + ATTRIBUTION_BATCH_SIZE) }, ...serviceAccess }));
    }
    for (let offset = 0; offset < nodeIds.length; offset += ATTRIBUTION_BATCH_SIZE) {
      pages.push(query("researchGraphLegacyRelations", { filters: { source: sources, status: "mapped", mapped_node_id: nodeIds.slice(offset, offset + ATTRIBUTION_BATCH_SIZE) }, ...serviceAccess }));
    }
    const rows = (await Promise.all(pages)).flat();
    let permissionPartial = false;
    const mappings = [...new Map(rows.filter((row) => {
      if (row.mappedEdgeId) return visibleEdges.has(row.mappedEdgeId);
      if (!row.mappedNodeKind || !row.mappedNodeId || !row.mappedNodeRevision) return false;
      if (!visibleNodes.has(researchRefKey({ kind: row.mappedNodeKind, id: row.mappedNodeId, revision: Number(row.mappedNodeRevision) }))) return false;
      const endpointRefs = legacyMappingEndpointRefs(row);
      const endpointsVisible = Array.isArray(endpointRefs)
        && endpointRefs.length > 0
        && endpointRefs.every((ref) => visibleLegacyMappingEndpoint(ref, (graph?.nodes ?? []).map((item) => item.ref)));
      if (!endpointsVisible) permissionPartial = true;
      return endpointsVisible;
    }).map((row) => [row.mappingId, row])).values()];
    return { mappings, permissionPartial };
  }

  function legacyTraversalEndpoints(relation, direction) {
    const targetIsUpstream = TARGET_IS_UPSTREAM.has(relation.relationType);
    const upstreamFrom = targetIsUpstream ? relation.sourceClaimId : relation.targetClaimId;
    const upstreamTo = targetIsUpstream ? relation.targetClaimId : relation.sourceClaimId;
    return direction === "upstream" ? { from: upstreamFrom, to: upstreamTo } : { from: upstreamTo, to: upstreamFrom };
  }

  async function legacyClaimGraphFromResearchGraph({ claimId, maxDepth, direction, accessToken = null, actorId = null } = {}) {
    const access = await scopedResearchAccess(accessToken, actorId);
    const visited = new Set([claimId]);
    let frontier = [{ claimId, depth: 0, path: [claimId] }];
    const nodes = [];
    const edges = [];
    const seenEdges = new Set();
    let truncated = false;
    let permissionPartial = false;
    while (frontier.length > 0 && frontier[0].depth < maxDepth) {
      const next = [];
      for (const current of frontier) {
        const graph = await researchNeighborhood({
          root: { kind: "claim", id: current.claimId }, direction: "both", depth: 2,
          nodeKinds: [], edgeTypes: [], nodeLimit: RESEARCH_GRAPH_MAX_NODES, edgeLimit: RESEARCH_GRAPH_MAX_EDGES,
          accessToken, actorId,
        });
        if (!graph) {
          if (current.depth === 0) throw new SupabaseReadRepositoryError("research Claim node not found", "SUPABASE_GRAPH_COMPAT_NODE_NOT_FOUND", 404);
          permissionPartial = true;
          continue;
        }
        truncated ||= Boolean(graph.truncated);
        permissionPartial ||= Boolean(graph.permissionPartial);
        const mapped = await legacyMappingsForNeighborhood(graph, ["claim_relation"]);
        permissionPartial ||= mapped.permissionPartial;
        const relations = mapped.mappings.map(normalizeLegacyClaimRelation).filter(Boolean);
        for (const relation of relations) {
          const { from, to } = legacyTraversalEndpoints(relation, direction);
          if (from !== current.claimId) continue;
          const edgeKey = `${relation.sourceClaimId}\u0000${relation.targetClaimId}\u0000${relation.relationType}`;
          if (!seenEdges.has(edgeKey)) {
            if (edges.length >= CLAIM_GRAPH_MAX_EDGES) { truncated = true; break; }
            seenEdges.add(edgeKey);
            edges.push({ ...relation, depth: current.depth + 1, path: [...current.path, to] });
          }
          if (visited.has(to)) continue;
          if (nodes.length >= CLAIM_GRAPH_MAX_NODES) { truncated = true; break; }
          visited.add(to);
          const item = { claimId: to, depth: current.depth + 1, path: [...current.path, to] };
          nodes.push(item);
          next.push(item);
        }
      }
      frontier = next;
    }
    const hydrated = [];
    for (let offset = 0; offset < nodes.length; offset += CLAIM_GRAPH_FRONTIER_BATCH_SIZE) {
      const ids = nodes.slice(offset, offset + CLAIM_GRAPH_FRONTIER_BATCH_SIZE).map((item) => item.claimId);
      /* Each ID came from the already permission-clipped kernel graph. The
       * API-token bridge uses service credentials for the legacy projection,
       * whose rows do not carry project_id, so re-running rowAllowed here
       * would incorrectly erase authorized private nodes. */
      hydrated.push(...await query("claims", { filters: { claim_id: ids }, ...access.callerAccess }));
    }
    const byId = new Map(hydrated.map((claim) => [claim.claimId, claim]));
    return {
      rootClaimId: claimId,
      maxDepth,
      nodes: nodes.map((item) => ({ ...(byId.get(item.claimId) ?? {}), ...item })),
      edges,
      truncated,
      permissionPartial,
    };
  }

  async function visibleLegacyEvidenceLinksForClaim(claimId, claimRevision, { accessToken = null, actorId = null } = {}) {
    const graph = await researchNeighborhood({
      root: { kind: "claim", id: claimId, revision: claimRevision }, direction: "both", depth: 2,
      nodeKinds: [], edgeTypes: [], nodeLimit: RESEARCH_GRAPH_MAX_NODES, edgeLimit: RESEARCH_GRAPH_MAX_EDGES,
      accessToken, actorId,
    });
    if (!graph) return { links: [], permissionPartial: true };
    const mapped = await legacyMappingsForNeighborhood(graph, ["evidence_claim_link"]);
    const links = mapped.mappings.map(normalizeLegacyEvidenceLink)
      .filter((item) => item && item.claimId === claimId && item.claimRevision === Number(claimRevision));
    return { links, permissionPartial: Boolean(graph.permissionPartial || graph.truncated || mapped.permissionPartial) };
  }

  async function legacyEvidenceFromResearchGraph({ evidenceId, accessToken = null, actorId = null } = {}) {
    const access = await scopedResearchAccess(accessToken, actorId);
    const graph = await researchNeighborhood({
      root: { kind: "evidence", id: evidenceId }, direction: "both", depth: 2,
      nodeKinds: [], edgeTypes: [], nodeLimit: RESEARCH_GRAPH_MAX_NODES, edgeLimit: RESEARCH_GRAPH_MAX_EDGES,
      accessToken, actorId,
    });
    if (!graph) return null;
    const evidence = (await query("evidence", { filters: { evidence_id: evidenceId }, limit: 1, ...access.callerAccess }))[0] ?? null;
    if (!evidence) throw new SupabaseReadRepositoryError("legacy Evidence projection not found", "SUPABASE_GRAPH_COMPAT_PROJECTION_NOT_FOUND", 500);
    const mapped = await legacyMappingsForNeighborhood(graph, ["evidence_claim_link"]);
    const claimLinks = mapped.mappings.map(normalizeLegacyEvidenceLink).filter((item) => item?.evidenceId === evidenceId);
    return { evidence, claimLinks, permissionPartial: Boolean(graph.permissionPartial || graph.truncated || mapped.permissionPartial) };
  }

  async function legacyChallengeFromResearchGraph({ challengeId, accessToken = null, actorId = null } = {}) {
    const access = await scopedResearchAccess(accessToken, actorId);
    const challenge = (await query("challenges", { filters: { challenge_id: challengeId }, limit: 1, ...access.callerAccess }))[0] ?? null;
    if (!challenge) return null;
    const currentRevision = (await query("challengeRevisions", { filters: { challenge_id: challengeId }, order: "revision.desc", limit: 1, ...access.callerAccess }))[0] ?? null;
    if (!currentRevision) throw new SupabaseReadRepositoryError("current Challenge revision not found", "SUPABASE_GRAPH_COMPAT_REVISION_NOT_FOUND", 500);
    const graph = await researchNeighborhood({
      root: { kind: "challenge", id: challengeId, revision: Number(currentRevision.revision) }, direction: "both", depth: 2,
      nodeKinds: [], edgeTypes: [], nodeLimit: RESEARCH_GRAPH_MAX_NODES, edgeLimit: RESEARCH_GRAPH_MAX_EDGES,
      accessToken, actorId,
    });
    if (!graph) return null;
    const impactMappings = await legacyMappingsForNeighborhood(graph, ["challenge_impact"]);
    const impacts = impactMappings.mappings.map((mapping) => mapping.sourcePayload).filter((payload) => {
      const id = legacyPayloadField(payload, "challengeId", "challenge_id");
      const revision = Number(legacyPayloadField(payload, "challengeRevision", "challenge_revision", 1));
      return id === challengeId && revision === Number(currentRevision.revision);
    });
    const evidence = await visibleLegacyEvidenceLinksForClaim(currentRevision.targetClaimId, currentRevision.targetClaimRevision, { accessToken, actorId });
    return {
      challenge,
      currentRevision,
      statusPolicy: { state: currentRevision.state, allowedTransitions: [...challengeTransitionsFrom(currentRevision.state)] },
      impacts,
      linkedEvidence: evidence.links,
      permissionPartial: Boolean(graph.permissionPartial || graph.truncated || impactMappings.permissionPartial || evidence.permissionPartial),
    };
  }

  async function legacyVerificationReceiptFromResearchGraph({ receiptId, accessToken = null, actorId = null } = {}) {
    const access = await scopedResearchAccess(accessToken, actorId);
    const graph = await researchNeighborhood({
      root: { kind: "verification_receipt", id: receiptId }, direction: "both", depth: 1,
      nodeKinds: [], edgeTypes: [], nodeLimit: RESEARCH_GRAPH_MAX_NODES, edgeLimit: RESEARCH_GRAPH_MAX_EDGES,
      accessToken, actorId,
    });
    if (!graph) return null;
    const receipt = (await query("verificationReceipts", { filters: { receipt_id: receiptId }, limit: 1, ...access.callerAccess }))[0] ?? null;
    if (!receipt) throw new SupabaseReadRepositoryError("legacy VerificationReceipt projection not found", "SUPABASE_GRAPH_COMPAT_PROJECTION_NOT_FOUND", 500);
    const findings = await query("verificationFindings", { filters: { receipt_id: receiptId }, ...access.callerAccess });
    return { receipt, findings, permissionPartial: Boolean(graph.permissionPartial || graph.truncated) };
  }

  async function listLegacyClaimVerificationsFromResearchGraph({ claimId, outcome = null, contextMode = null, filterActorId = null, accessToken = null, actorId = null } = {}) {
    const access = await scopedResearchAccess(accessToken, actorId);
    const receipts = await query("verificationReceipts", { filters: { claim_id: claimId, outcome, context_mode: contextMode, created_by: filterActorId }, ...access.callerAccess });
    const visible = [];
    for (const receipt of receipts) {
      const graph = await researchNeighborhood({
        root: { kind: "verification_receipt", id: receipt.receiptId }, direction: "both", depth: 1,
        nodeKinds: [], edgeTypes: [], nodeLimit: 1, edgeLimit: 1, accessToken, actorId,
      });
      if (graph) visible.push(receipt);
    }
    return visible;
  }

  const typedReadDefinitions = Object.freeze({
    answer: Object.freeze({ table: "researchAnswers", idField: "answerId" }),
    rebuttal: Object.freeze({ table: "researchRebuttals", idField: "rebuttalId" }),
    evaluation: Object.freeze({ table: "researchEvaluations", idField: "evaluationId" }),
    dataset: Object.freeze({ table: "researchDatasets", idField: "datasetId" }),
    tool: Object.freeze({ table: "researchTools", idField: "toolId" }),
  });

  async function typedRows(kind, { id = null, projectId = null, state = null, stance = null, toolKind = null, currentOnly = true, accessToken = null, actorId = null } = {}) {
    const definition = typedReadDefinitions[kind];
    const access = await scopedResearchAccess(accessToken, actorId);
    const filters = {
      ...(id ? { [definition.idField.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)]: id } : {}),
      ...(projectId ? { project_id: projectId } : {}),
      ...(state ? { state } : {}),
      ...(stance && kind === "evaluation" ? { stance } : {}),
      ...(toolKind && kind === "tool" ? { tool_kind: toolKind } : {}),
      ...(currentOnly ? { is_current: true } : {}),
    };
    const rows = await query(definition.table, { filters, ...access.callerAccess });
    return { access, rows: rows.filter(access.rowAllowed) };
  }

  function typedIdentity(kind, row) {
    const { idField } = typedReadDefinitions[kind];
    return {
      [idField]: row[idField],
      projectId: row.projectId,
      state: row.state,
      label: row.label,
      canonicalHref: row.canonicalHref,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    };
  }

  async function visibleIncomingRows(target, edgeTypes, access) {
    const rows = await query("researchGraphEdges", {
      filters: { target_kind: target.kind, target_id: target.id, target_revision: target.revision, edge_type: edgeTypes },
      ...access.callerAccess,
    });
    if (!access.usesApiTokenBridge || rows.length === 0) return rows;
    const sources = rows.map((row) => edgeEndpoint(row, "source"));
    const sourceRows = await exactResearchRows(sources, access.callerAccess, access.rowAllowed);
    const visible = new Set(sourceRows.map((row) => researchRefKey(rowRef(row))));
    return rows.filter((row) => visible.has(researchRefKey(edgeEndpoint(row, "source"))));
  }

  async function evaluationBases(evaluationId, evaluationRevision, { accessToken = null, actorId = null } = {}) {
    const access = await scopedResearchAccess(accessToken, actorId);
    const rows = await query("researchEvaluationBases", { filters: { evaluation_id: evaluationId, evaluation_revision: evaluationRevision }, ...access.callerAccess });
    let visibleRows = rows;
    if (access.usesApiTokenBridge && rows.length > 0) {
      const refs = rows.map((row) => ({ kind: row.basisKind, id: row.basisId, revision: Number(row.basisRevision) }));
      const sourceRows = await exactResearchRows(refs, access.callerAccess, access.rowAllowed);
      const visible = new Set(sourceRows.map((row) => researchRefKey(rowRef(row))));
      visibleRows = rows.filter((row) => visible.has(researchRefKey({ kind: row.basisKind, id: row.basisId, revision: Number(row.basisRevision) })));
    }
    return visibleRows.map((row) => ({
      evaluationId: row.evaluationId,
      evaluationRevision: Number(row.evaluationRevision),
      basisKind: row.basisKind,
      basisId: row.basisId,
      basisRevision: Number(row.basisRevision),
    }));
  }

  async function typedCurrentRevision(kind, id, options = {}) {
    const { access, rows } = await typedRows(kind, { id, currentOnly: true, ...options });
    const row = rows[0] ?? null;
    if (!row) return null;
    const target = { kind, id, revision: Number(row.revision) };
    const common = { [typedReadDefinitions[kind].idField]: id, revision: target.revision, supersedesRevision: row.supersedesRevision ?? null, state: row.state, label: row.label, createdAt: row.createdAt, createdBy: row.createdBy };
    if (kind === "answer") {
      const incoming = await visibleIncomingRows(target, ["answers", "derived_from"], access);
      return {
        ...common,
        title: row.title,
        synthesis: row.synthesis,
        limitations: row.limitations ?? [],
        questionRef: incoming.find((edge) => edge.edgeType === "answers") ? edgeEndpoint(incoming.find((edge) => edge.edgeType === "answers"), "source") : null,
        additionalInputs: incoming.filter((edge) => edge.edgeType === "derived_from").map((edge) => edgeEndpoint(edge, "source")),
      };
    }
    if (kind === "rebuttal") {
      const incoming = await visibleIncomingRows(target, ["rebuts", "grounds_rebuttal"], access);
      return {
        ...common,
        title: row.title,
        argument: row.argument,
        scope: row.scope ?? [],
        targetRef: incoming.find((edge) => edge.edgeType === "rebuts") ? edgeEndpoint(incoming.find((edge) => edge.edgeType === "rebuts"), "source") : null,
        basisRefs: incoming.filter((edge) => edge.edgeType === "grounds_rebuttal").map((edge) => edgeEndpoint(edge, "source")),
      };
    }
    if (kind === "evaluation") {
      const bases = await evaluationBases(id, target.revision, options);
      return { ...common, subjectRef: { kind: row.subjectKind, id: row.subjectId, revision: Number(row.subjectRevision) }, basisRefs: bases.map((basis) => ({ kind: basis.basisKind, id: basis.basisId, revision: basis.basisRevision })), stance: row.stance, rationale: row.rationale, method: row.method ?? null };
    }
    if (kind === "dataset") {
      const incoming = await visibleIncomingRows(target, ["materializes_dataset"], access);
      return { ...common, name: row.name, description: row.description, version: row.version, license: row.license, schemaUri: row.schemaUri ?? null, provenance: row.provenance, artifactRef: incoming[0] ? edgeEndpoint(incoming[0], "source") : null };
    }
    const incoming = await visibleIncomingRows(target, ["packages_tool"], access);
    return { ...common, name: row.name, description: row.description, toolKind: row.toolKind, version: row.version, runtime: row.runtime, inputSchemaUri: row.inputSchemaUri ?? null, outputSchemaUri: row.outputSchemaUri ?? null, license: row.license, provenance: row.provenance, artifactRef: incoming[0] ? edgeEndpoint(incoming[0], "source") : null };
  }

  async function listTyped(kind, options = {}) {
    const { rows } = await typedRows(kind, options);
    return rows.map((row) => ({ ...typedIdentity(kind, row), ...(kind === "evaluation" ? { stance: row.stance } : {}), ...(kind === "tool" ? { toolKind: row.toolKind } : {}) }));
  }

  async function getTyped(kind, id, options = {}) {
    const { rows } = await typedRows(kind, { id, currentOnly: true, ...options });
    return rows[0] ? typedIdentity(kind, rows[0]) : null;
  }

  /* Revision getter per object type for the provenance path. */
  const REVISION_TABLES = {
    question: ["questionRevisions", "question_id"],
    task: ["taskRevisions", "task_id"],
    claim: ["claimRevisions", "claim_id"],
    project: ["projectRevisions", "project_id"],
    artifact: ["artifactRevisions", "artifact_id"],
    challenge: ["challengeRevisions", "challenge_id"],
  };

  return Object.freeze({
    /* ---- actor directory + identity card (M13.8) ---- */
    listActors: async () => query("actorDirectory", { select: ACTOR_PUBLIC_SELECT }),
    async getActor(actorId) {
      return getPublicActor(actorId);
    },
    async getActorProfile(actorId) {
      return getOne("actorProfiles", { actor_id: actorId });
    },
    listContributionStatements: (actorId) => list("contributionStatements", { actor_id: actorId }),
    listContributionEdges: (statementIds) => list("contributionEdges", { statement_id: statementIds }),
    listContributionStatementsByIds: (statementIds) => list("contributionStatements", { statement_id: statementIds }),
    listContributionEdgesForObject: ({ objectType, objectId, objectRevision = null }) =>
      query("contributionEdges", {
        filters: { object_type: objectType, object_id: objectId, ...(objectRevision !== null && objectRevision !== undefined ? { object_revision: objectRevision } : {}) },
        limit: CONTRIBUTION_EDGES_OBJECT_LIMIT,
      }),

    /* ---- engagement signals + recommendations (client-token writes) ---- */
    async findIdentity(provider, subject, { accessToken = null } = {}) {
      const rows = accessToken
        ? (await authedRequest("identities", { accessToken, params: { select: "*", provider: `eq.${provider}`, subject: `eq.${subject}`, deleted_at: "is.null", limit: "1" } })).payload
        : await query("identities", { filters: { provider, subject }, limit: 1 });
      const row = Array.isArray(rows) ? rows[0] ?? null : null;
      return row ? mapRow(row) : null;
    },
    async getInteractionTarget(objectType, objectId) {
      const spec = INTERACTION_TARGET_SPECS[objectType];
      if (!spec) return null;
      return getOne(spec.table, { [spec.idColumn]: objectId });
    },
    async provisionSelfActor({ accessToken, subject, email = null } = {}) {
      const existing = await this.findIdentity("supabase", subject, { accessToken });
      if (existing) {
        return { actor: await getPublicActor(existing.actorId), created: false };
      }
      const newActorId = `actor_${crypto.randomUUID()}`;
      const actorInsert = await authedRequest("actors", {
        accessToken, method: "POST", prefer: "return=minimal",
        body: [{ actor_id: newActorId, actor_type: "human", identity_strength: "self_declared", auth_subject: subject }],
      });
      if (!actorInsert.ok) {
        const raced = await this.findIdentity("supabase", subject, { accessToken });
        if (raced) return { actor: await getPublicActor(raced.actorId), created: false };
        throw authedFailure(actorInsert, "SUPABASE_READ_PROVISION_FAILED");
      }
      const identityInsert = await authedRequest("identities", {
        accessToken, method: "POST", prefer: "return=representation",
        body: [{ actor_id: newActorId, provider: "supabase", subject, ...(email ? { email } : {}) }],
      });
      if (!identityInsert.ok) {
        const raced = await this.findIdentity("supabase", subject, { accessToken });
        if (raced) return { actor: await getPublicActor(raced.actorId), created: false };
        throw authedFailure(identityInsert, "SUPABASE_READ_PROVISION_FAILED");
      }
      const actor = await getPublicActor(newActorId);
      return { actor, created: true };
    },
    async recordInteraction({ accessToken, actorId, objectType, objectId, kind } = {}) {
      const result = await authedRequest("engagementInteractions", {
        accessToken, method: "POST", prefer: "resolution=ignore-duplicates",
        body: [{ interaction_id: `itx_${crypto.randomUUID()}`, actor_id: actorId, object_type: objectType, object_id: objectId, kind }],
      });
      if (!result.ok) throw authedFailure(result, "SUPABASE_READ_ENGAGEMENT_WRITE_FAILED");
      return { recorded: true };
    },
    async removeInteraction({ accessToken, actorId, objectType, objectId, kind } = {}) {
      const result = await authedRequest("engagementInteractions", {
        accessToken, method: "DELETE",
        params: { actor_id: `eq.${actorId}`, object_type: `eq.${objectType}`, object_id: `eq.${objectId}`, kind: `eq.${kind}` },
      });
      if (!result.ok) throw authedFailure(result, "SUPABASE_READ_ENGAGEMENT_WRITE_FAILED");
      return { removed: true };
    },
    async listInteractionsForActor({ accessToken, actorId, kinds = null } = {}) {
      const params = { select: "*", actor_id: `eq.${actorId}`, order: "created_at.desc,interaction_id.desc", limit: "500" };
      if (kinds) params.kind = `in.(${kinds.join(",")})`;
      const result = await authedRequest("engagementInteractions", { accessToken, params });
      if (!result.ok) throw authedFailure(result, "SUPABASE_READ_ENGAGEMENT_READ_FAILED");
      return Array.isArray(result.payload) ? result.payload.map(mapRow) : [];
    },
    async listRecommendationsForActor({ accessToken, actorId, limit = 12 } = {}) {
      const result = await authedRequest("recommendationCache", {
        accessToken,
        params: { select: "*", actor_id: `eq.${actorId}`, order: "rank.asc", limit: String(Math.min(Math.max(limit, 1), 24)) },
      });
      if (!result.ok) throw authedFailure(result, "SUPABASE_READ_ENGAGEMENT_READ_FAILED");
      return Array.isArray(result.payload) ? result.payload.map(mapRow) : [];
    },

    /* ---- project / question / task / claim lists and details ---- */
    listProjects: ({ state = null } = {}) => list("projects", { state }),
    async getProject(projectId) {
      return getOne("projects", { project_id: projectId });
    },
    getCurrentProjectRevision: (projectId) => currentRevision("projectRevisions", "project_id", projectId),

    listQuestions: ({ projectId = null, state = null } = {}) => list("questions", { project_id: projectId, state }),
    async getQuestion(questionId) {
      return getOne("questions", { question_id: questionId });
    },
    getCurrentQuestionRevision: (questionId) => currentRevision("questionRevisions", "question_id", questionId),
    getResearchContractRevision: (contractId, revision) => getOne("researchContractRevisions", { contract_id: contractId, revision }),

    async listTasks({ projectId = null, status = null, type = null, tag = null } = {}) {
      /* Task type and tags live on task revisions, not the task projection:
       * resolve each task's current revision and filter on it, matching the
       * self-hosted semantics instead of rejecting the filter. */
      let currentByTask = null;
      if ((type !== null && type !== undefined) || (tag !== null && tag !== undefined)) {
        const revisions = await list("taskRevisions");
        currentByTask = new Map();
        for (const revision of revisions) {
          if (!currentByTask.has(revision.taskId)) currentByTask.set(revision.taskId, revision);
        }
      }
      const rows = await list("tasks", { state: status });
      let filtered = rows;
      if (type !== null && type !== undefined) filtered = filtered.filter((row) => currentByTask.get(row.taskId)?.taskType === type);
      if (tag !== null && tag !== undefined) filtered = filtered.filter((row) => (currentByTask.get(row.taskId)?.tags ?? []).includes(tag));
      const questionIds = await questionIdsForProject(projectId);
      return questionIds === null ? filtered : filtered.filter((row) => questionIds.has(row.questionId));
    },
    async getTask(taskId) {
      return getOne("tasks", { task_id: taskId });
    },
    getCurrentTaskRevision: (taskId) => currentRevision("taskRevisions", "task_id", taskId),
    listTaskDependencies: (taskId) => list("taskDependencies", { target_task_id: taskId }),
    listCurrentTaskLeases: async (taskId) => {
      const leases = await list("taskLeases", { task_id: taskId });
      return leases.filter((lease) => !lease.expiresAt || Date.parse(lease.expiresAt) > Date.now());
    },

    async listClaims({ projectId = null, status = null, tag = null } = {}) {
      if (tag !== null) unsupportedFilter("claim tag");
      const rows = await list("claims", { state: status });
      const questionIds = await questionIdsForProject(projectId);
      return questionIds === null ? rows : rows.filter((row) => questionIds.has(row.questionId));
    },
    async getClaim(claimId) {
      return getOne("claims", { claim_id: claimId });
    },
    getCurrentClaimRevision: (claimId) => currentRevision("claimRevisions", "claim_id", claimId),
    getClaimRevision: (claimId, revision) => getOne("claimRevisions", { claim_id: claimId, revision }),
    getClaimUpstreamGraph: ({ claimId, maxDepth }) => claimGraph({ claimId, maxDepth, direction: "upstream" }),
    getClaimDownstreamGraph: ({ claimId, maxDepth }) => claimGraph({ claimId, maxDepth, direction: "downstream" }),
    getResearchNeighborhood: researchNeighborhood,
    getLegacyClaimGraphFromResearchGraph: legacyClaimGraphFromResearchGraph,
    async executeLegacyResearchMutationDualWrite({ mutationKind, command, verifiedEvents, expectedLegacy } = {}) {
      if (!LEGACY_DUAL_WRITE_MUTATION_KINDS.has(mutationKind)) throw new SupabaseReadRepositoryError("dual-write mutation kind is unsupported", "SUPABASE_GRAPH_DUAL_WRITE_INVALID", 400);
      if (!command || typeof command !== "object" || Array.isArray(command)) throw new SupabaseReadRepositoryError("dual-write command must be an object", "SUPABASE_GRAPH_DUAL_WRITE_INVALID", 400);
      if (!Array.isArray(verifiedEvents) || verifiedEvents.length === 0) throw new SupabaseReadRepositoryError("dual-write requires verified immutable events", "SUPABASE_GRAPH_DUAL_WRITE_EVENT_REQUIRED", 400);
      return serviceRpc("execute_research_graph_legacy_dual_write", {
        p_mutation_kind: mutationKind,
        p_command: command,
        p_verified_events: verifiedEvents,
        p_expected_legacy: expectedLegacy,
      });
    },
    listAnswers: (options = {}) => listTyped("answer", options),
    getAnswer: (answerId, options = {}) => getTyped("answer", answerId, options),
    getCurrentAnswerRevision: (answerId, options = {}) => typedCurrentRevision("answer", answerId, options),
    listRebuttals: (options = {}) => listTyped("rebuttal", options),
    getRebuttal: (rebuttalId, options = {}) => getTyped("rebuttal", rebuttalId, options),
    getCurrentRebuttalRevision: (rebuttalId, options = {}) => typedCurrentRevision("rebuttal", rebuttalId, options),
    listEvaluations: (options = {}) => listTyped("evaluation", options),
    getEvaluation: (evaluationId, options = {}) => getTyped("evaluation", evaluationId, options),
    getCurrentEvaluationRevision: (evaluationId, options = {}) => typedCurrentRevision("evaluation", evaluationId, options),
    listEvaluationBases: evaluationBases,
    listDatasets: (options = {}) => listTyped("dataset", options),
    getDataset: (datasetId, options = {}) => getTyped("dataset", datasetId, options),
    getCurrentDatasetRevision: (datasetId, options = {}) => typedCurrentRevision("dataset", datasetId, options),
    listTools: (options = {}) => listTyped("tool", options),
    getTool: (toolId, options = {}) => getTyped("tool", toolId, options),
    getCurrentToolRevision: (toolId, options = {}) => typedCurrentRevision("tool", toolId, options),
    async listDirectDependentClaimIds(claimId) {
      const relations = await list("claimRelations", { target_claim_id: claimId, relation_type: "depends_on" });
      return [...new Set(relations.map((relation) => relation.sourceClaimId).filter((value) => typeof value === "string" && value))];
    },

    /* ---- frontier snapshots ---- */
    listFrontierSnapshots: ({ projectId = null } = {}) => list("frontierSnapshots", { project_id: projectId }),
    getFrontierSnapshot: (snapshotId) => getOne("frontierSnapshots", { snapshot_id: snapshotId }),
    listFrontierMembers: (snapshotId) => list("frontierMembers", { snapshot_id: snapshotId }),
    async listFrontiersForObjectRevision({ objectType, objectId, objectRevision = null }) {
      if (objectType !== "claim") return [];
      const members = await list("frontierMembers", { claim_id: objectId, ...(objectRevision !== null && objectRevision !== undefined ? { claim_revision: objectRevision } : {}) });
      const snapshotIds = [...new Set(members.map((member) => member.snapshotId).filter(Boolean))];
      if (snapshotIds.length === 0) return [];
      return list("frontierSnapshots", { snapshot_id: snapshotIds });
    },

    /* ---- evidence ---- */
    async listEvidence({ evidenceType = null, claimId = null } = {}) {
      if (claimId !== null && claimId !== undefined) {
        const links = await list("evidenceClaimLinks", { claim_id: claimId });
        const evidenceIds = [...new Set(links.map((link) => link.evidenceId).filter(Boolean))];
        if (evidenceIds.length === 0) return [];
        const rows = await list("evidence", { evidence_id: evidenceIds });
        return evidenceType ? rows.filter((row) => row.evidenceType === evidenceType) : rows;
      }
      return list("evidence", { evidence_type: evidenceType });
    },
    getEvidence: (evidenceId) => getOne("evidence", { evidence_id: evidenceId }),
    listEvidenceClaimLinks: (evidenceId) => list("evidenceClaimLinks", { evidence_id: evidenceId }),
    listEvidenceForClaimRevision: (claimId, claimRevision) => list("evidenceClaimLinks", { claim_id: claimId, claim_revision: claimRevision }),
    getLegacyEvidenceFromResearchGraph: legacyEvidenceFromResearchGraph,

    /* ---- verification receipts ---- */
    listVerificationReceipts: ({ claimId = null, outcome = null, contextMode = null, actorId = null } = {}) =>
      list("verificationReceipts", { claim_id: claimId, outcome, context_mode: contextMode, created_by: actorId }),
    listVerificationReceiptsByActorRun: (actorId, runId) => list("verificationReceipts", { created_by: actorId, run_id: runId }),
    getVerificationContractRevision: (contractId, revision) => getOne("verificationContractRevisions", { contract_id: contractId, revision }),
    getVerificationReceipt: (receiptId) => getOne("verificationReceipts", { receipt_id: receiptId }),
    listVerificationFindings: (receiptId) => list("verificationFindings", { receipt_id: receiptId }),
    getLegacyVerificationReceiptFromResearchGraph: legacyVerificationReceiptFromResearchGraph,
    listLegacyClaimVerificationsFromResearchGraph,

    /* ---- attempts / runs / artifacts ---- */
    getAttempt: (attemptId) => getOne("attempts", { attempt_id: attemptId }),
    listTraceEvents: (attemptId) => list("traceEvents", { attempt_id: attemptId }),

    listRuns: ({ taskId = null } = {}) => list("runs", { task_id: taskId }),
    getRun: (runId) => getOne("runs", { run_id: runId }),
    listRunInputs: (runId) => list("runInputs", { run_id: runId }),
    listRunOutputs: (runId) => list("runOutputs", { run_id: runId }),

    async listArtifacts({ artifactType = null, createdBy = null } = {}) {
      let artifactIds = null;
      if (artifactType !== null && artifactType !== undefined) {
        const revisions = await list("artifactRevisions", { artifact_type: artifactType });
        artifactIds = [...new Set(revisions.map((revision) => revision.artifactId))];
        if (artifactIds.length === 0) return [];
      }
      return list("artifacts", { created_by: createdBy, ...(artifactIds ? { artifact_id: artifactIds } : {}) });
    },
    getArtifact: (artifactId) => getOne("artifacts", { artifact_id: artifactId }),
    getCurrentArtifactRevision: (artifactId) => currentRevision("artifactRevisions", "artifact_id", artifactId),
    getArtifactRevision: (artifactId, revision) => getOne("artifactRevisions", { artifact_id: artifactId, revision }),
    listArtifactLocations: (artifactId) => list("artifactLocations", { artifact_id: artifactId }),

    /* ---- challenges / context bundles / merge proposals / checkpoints ---- */
    getChallenge: (challengeId) => getOne("challenges", { challenge_id: challengeId }),
    getLegacyChallengeFromResearchGraph: legacyChallengeFromResearchGraph,
    getCurrentChallengeRevision: (challengeId) => currentRevision("challengeRevisions", "challenge_id", challengeId),
    listChallengeImpacts: (challengeId, revision) => list("challengeImpacts", { challenge_id: challengeId, challenge_revision: revision }),

    getContextBundleForTask: ({ taskId, mode }) => getOne("contextBundles", { task_id: taskId, mode }),

    getMergeProposal: (proposalId) => getOne("mergeProposals", { proposal_id: proposalId }),

    getMerkleCheckpoint: (checkpointId) => getOne("merkleCheckpoints", { checkpoint_id: checkpointId }),
    getMerkleCheckpointForEvent: (eventId) =>
      getOne("merkleCheckpoints", { and: `(first_event_id.lte.${eventId},last_event_id.gte.${eventId})` }),

    /* ---- research events ---- */
    async listResearchEvents({ objectType = null, objectId = null, actorId = null, eventType = null, createdAfter = null, createdBefore = null, order = "asc", page = null } = {}) {
      let descendantClaimIds = new Set();
      if (objectType === "question" && objectId) {
        const claims = await query("claims", { filters: { question_id: objectId }, select: "claim_id", limit: QUESTION_EVENT_CLAIM_LIMIT + 1 });
        if (claims.length > QUESTION_EVENT_CLAIM_LIMIT) {
          throw new SupabaseReadRepositoryError("Question event scope exceeds the hosted Claim membership limit", "SUPABASE_READ_SCOPE_TOO_BROAD", 413);
        }
        descendantClaimIds = new Set(claims.map((claim) => claim.claimId));
      }
      const filters = {};
      if (eventType) filters.event_type = eventType;
      if (createdAfter) filters.created_at = { op: "gte", value: createdAfter };
      else if (createdBefore) filters.created_at = { op: "lte", value: createdBefore };
      const logicalPredicates = [];
      if (actorId) logicalPredicates.push(eventActorPredicate(actorId));
      if (objectType && objectId) logicalPredicates.push(eventObjectPredicate(objectType, objectId, [...descendantClaimIds]));
      if (createdAfter && createdBefore) logicalPredicates.push(`created_at.lte.${createdBefore}`);
      if (page?.after) {
        const comparison = order === "desc" ? "lt" : "gt";
        logicalPredicates.push(`created_at.${comparison}.${page.after.createdAt},and(created_at.eq.${page.after.createdAt},event_id.${comparison}.${page.after.id})`);
      }
      if (logicalPredicates.length === 1) filters.or = `(${logicalPredicates[0]})`;
      else if (logicalPredicates.length > 1) filters.and = `(${logicalPredicates.map((predicate) => `or(${predicate})`).join(",")})`;
      const rows = await query("researchEvents", {
        filters,
        order: order === "desc" ? "created_at.desc,event_id.desc" : TABLE_ORDERS.researchEvents,
        limit: page?.limit ?? null,
      });
      return rows.filter((row) => {
        const payload = row.payload ?? {};
        if (createdBefore && !(Date.parse(row.createdAt ?? "") <= Date.parse(createdBefore))) return false;
        if (objectType && objectId && !eventReferencesObject(payload, objectType, objectId, descendantClaimIds)) return false;
        if (actorId && !EVENT_ACTOR_PAYLOAD_KEYS.some((key) => payloadTextEquals(payload[key], actorId))) return false;
        return true;
      });
    },
    async getLatestResearchEventForActor(actorId) {
      return (await query("researchEvents", {
        filters: { or: `(${eventActorPredicate(actorId)})` },
        order: "created_at.desc,event_id.desc",
        limit: 1,
      }))[0] ?? null;
    },
    async listResearchEventRange({ firstEventId, lastEventId }) {
      const rows = await list("researchEvents");
      const first = rows.findIndex((row) => row.eventId === firstEventId);
      const last = rows.findIndex((row) => row.eventId === lastEventId);
      if (first < 0 || last < 0 || last < first) return [];
      return rows.slice(first, last + 1);
    },
    listResearchEventsByIds: (eventIds) => listByIdsInBatches("researchEvents", "event_id", eventIds),

    /* ---- provenance ---- */
    async getObjectRevision({ objectType, objectId, revision = null }) {
      const entry = REVISION_TABLES[objectType];
      if (!entry) return null;
      const [table, idColumn] = entry;
      if (revision === null || revision === undefined) return currentRevision(table, idColumn, objectId);
      return getOne(table, { [idColumn]: objectId, revision });
    },

    /* ---- api tokens (secret hash never selected) ---- */
    findActiveSigningKey: (actorId) =>
      getOne("signingKeys", { actor_id: actorId, revoked_at: { op: "is", value: "null" } }),
    listApiTokensByActor: (actorId) =>
      query("apiTokens", {
        filters: { actor_id: actorId },
        select: "token_id,token_prefix,scopes,expires_at,revoked_at,last_used_at",
      }),
  });
}
