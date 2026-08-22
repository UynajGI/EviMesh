const TABLES = Object.freeze({
  actors: "actors",
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
  questionRevisions: "question_revisions",
  questions: "questions",
  researchContractRevisions: "research_contract_revisions",
  researchEvents: "research_events",
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
const ATTRIBUTION_BATCH_SIZE = 50;
const EVENT_ACTOR_PAYLOAD_KEYS = Object.freeze(["actor_id", "signer_actor_id", "publisher_actor_id", "drafted_by_actor_id", "producer_actor_id", "run_actor_id"]);
const TABLE_ORDERS = Object.freeze({
  actors: "created_at.desc,actor_id.desc",
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
  questionRevisions: "revision.desc,question_id.desc",
  questions: "created_at.desc,question_id.desc",
  researchContractRevisions: "revision.desc,contract_id.desc",
  researchEvents: "created_at.asc,event_id.asc",
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
});

/** PostgREST filter value: `eq.x` for scalars, `in.(a,b)` for arrays, and
 *  `{ op, value }` for explicit operators (gte/lte/gt/lt/like/ilike). */
function filterValue(value) {
  if (Array.isArray(value)) return `in.(${value.map((entry) => String(entry).replaceAll(",", "").replaceAll(")", "")).join(",")})`;
  if (value && typeof value === "object" && typeof value.op === "string") return `${value.op}.${value.value}`;
  return `eq.${value}`;
}

function postgrestLogicLiteral(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function eventActorPredicate(actorId) {
  const literal = postgrestLogicLiteral(actorId);
  return EVENT_ACTOR_PAYLOAD_KEYS.map((key) => `payload->>${key}.eq.${literal}`).join(",");
}

/* Only mutable-projection tables carry lifecycle columns; the soft-delete
 * filter must not be applied to revision, event, or junction fact tables. */
const SOFT_DELETE_TABLES = new Set(["actors", "actorProfiles", "artifacts", "attempts", "challenges", "claimRelations", "claims", "identities", "projects", "questions", "signingKeys"]);

/* Interaction target tables: id columns differ per object type. */
const INTERACTION_TARGET_SPECS = Object.freeze({
  question: { table: "questions", idColumn: "question_id" },
  claim: { table: "claims", idColumn: "claim_id" },
  task: { table: "tasks", idColumn: "task_id" },
  project: { table: "projects", idColumn: "project_id" },
});

export function createSupabaseReadRepository({ url, publishableKey, fetchImpl = fetch } = {}) {
  const baseUrl = requiredString(url, "Supabase URL").replace(/\/$/, "");
  const apiKey = requiredString(publishableKey, "Supabase publishable key");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  async function query(table, { filters = {}, order = null, limit = null, select = "*" } = {}) {
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
        response = await fetchImpl(endpoint, { headers: { accept: "application/json", apikey: apiKey, Range: `${offset}-${offset + requestPageSize - 1}`, "Range-Unit": "items" } });
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
    while (frontier.length > 0 && frontier[0].depth < maxDepth) {
      /* Query each breadth-first frontier in bounded parallel batches. This
       * keeps request URLs bounded without issuing one serial round trip per
       * Claim. A relation spanning two batches is deduplicated below. */
      const batches = [];
      for (let offset = 0; offset < frontier.length; offset += CLAIM_GRAPH_FRONTIER_BATCH_SIZE) {
        batches.push(frontier.slice(offset, offset + CLAIM_GRAPH_FRONTIER_BATCH_SIZE).map((node) => node.claimId));
      }
      const incidentRows = (await Promise.all(batches.map((claimIds) => {
        const membership = filterValue(claimIds);
        return list("claimRelations", {
          or: `(source_claim_id.${membership},target_claim_id.${membership})`,
        });
      }))).flat();
      const incident = [...new Map(incidentRows.map((relation) => [
        `${relation.sourceClaimId}\u0000${relation.targetClaimId}\u0000${relation.relationType}`,
        relation,
      ])).values()];
      const nextFrontier = [];
      for (const current of frontier) {
        for (const relation of incident) {
          const { from, to: nextId } = traversalEndpoints(relation, direction);
          if (from !== current.claimId) continue;
          if (hasGraphPath(edgeAdjacency, relation.targetClaimId, relation.sourceClaimId)) continue;
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
      frontier = nextFrontier;
    }
    const claimIdBatches = [];
    for (let offset = 0; offset < nodes.length; offset += CLAIM_GRAPH_FRONTIER_BATCH_SIZE) {
      claimIdBatches.push(nodes.slice(offset, offset + CLAIM_GRAPH_FRONTIER_BATCH_SIZE).map((node) => node.claimId));
    }
    const claims = (await Promise.all(claimIdBatches.map((claimIds) => list("claims", { claim_id: claimIds })))).flat();
    const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
    return { nodes: nodes.map((node) => ({ ...(claimById.get(node.claimId) ?? {}), ...node })), edges };
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
    listActors: async () => list("actors"),
    async getActor(actorId) {
      return getOne("actors", { actor_id: actorId });
    },
    async getActorProfile(actorId) {
      return getOne("actorProfiles", { actor_id: actorId });
    },
    listContributionStatements: (actorId) => list("contributionStatements", { actor_id: actorId }),
    listContributionEdges: (statementIds) => list("contributionEdges", { statement_id: statementIds }),
    listContributionStatementsByIds: (statementIds) => list("contributionStatements", { statement_id: statementIds }),
    listContributionEdgesForObject: ({ objectType, objectId, objectRevision = null }) =>
      list("contributionEdges", { object_type: objectType, object_id: objectId, ...(objectRevision !== null && objectRevision !== undefined ? { object_revision: objectRevision } : {}) }),

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
        return { actor: await getOne("actors", { actor_id: existing.actorId }), created: false };
      }
      const newActorId = `actor_${crypto.randomUUID()}`;
      const actorInsert = await authedRequest("actors", {
        accessToken, method: "POST", prefer: "return=representation",
        body: [{ actor_id: newActorId, actor_type: "human", identity_strength: "self_declared", auth_subject: subject }],
      });
      if (!actorInsert.ok) {
        const raced = await this.findIdentity("supabase", subject, { accessToken });
        if (raced) return { actor: await getOne("actors", { actor_id: raced.actorId }), created: false };
        throw authedFailure(actorInsert, "SUPABASE_READ_PROVISION_FAILED");
      }
      const identityInsert = await authedRequest("identities", {
        accessToken, method: "POST", prefer: "return=representation",
        body: [{ actor_id: newActorId, provider: "supabase", subject, ...(email ? { email } : {}) }],
      });
      if (!identityInsert.ok) {
        const raced = await this.findIdentity("supabase", subject, { accessToken });
        if (raced) return { actor: await getOne("actors", { actor_id: raced.actorId }), created: false };
        throw authedFailure(identityInsert, "SUPABASE_READ_PROVISION_FAILED");
      }
      const actor = Array.isArray(actorInsert.payload) && actorInsert.payload[0] ? mapRow(actorInsert.payload[0]) : await getOne("actors", { actor_id: newActorId });
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

    /* ---- verification receipts ---- */
    listVerificationReceipts: ({ claimId = null, outcome = null, contextMode = null, actorId = null } = {}) =>
      list("verificationReceipts", { claim_id: claimId, outcome, context_mode: contextMode, created_by: actorId }),
    getVerificationReceipt: (receiptId) => getOne("verificationReceipts", { receipt_id: receiptId }),
    listVerificationFindings: (receiptId) => list("verificationFindings", { receipt_id: receiptId }),

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
    getCurrentChallengeRevision: (challengeId) => currentRevision("challengeRevisions", "challenge_id", challengeId),
    listChallengeImpacts: (challengeId, revision) => list("challengeImpacts", { challenge_id: challengeId, challenge_revision: revision }),

    getContextBundleForTask: ({ taskId, mode }) => getOne("contextBundles", { task_id: taskId, mode }),

    getMergeProposal: (proposalId) => getOne("mergeProposals", { proposal_id: proposalId }),

    getMerkleCheckpoint: (checkpointId) => getOne("merkleCheckpoints", { checkpoint_id: checkpointId }),
    getMerkleCheckpointForEvent: (eventId) =>
      getOne("merkleCheckpoints", { and: `(first_event_id.lte.${eventId},last_event_id.gte.${eventId})` }),

    /* ---- research events ---- */
    async listResearchEvents({ objectType = null, objectId = null, actorId = null, eventType = null, createdAfter = null, createdBefore = null, order = "asc", page = null } = {}) {
      const filters = {};
      if (eventType) filters.event_type = eventType;
      if (createdAfter) filters.created_at = { op: "gte", value: createdAfter };
      const actorPredicate = actorId ? eventActorPredicate(actorId) : null;
      let cursorPredicate = null;
      if (page?.after) {
        const comparison = order === "desc" ? "lt" : "gt";
        cursorPredicate = `created_at.${comparison}.${page.after.createdAt},and(created_at.eq.${page.after.createdAt},event_id.${comparison}.${page.after.id})`;
      }
      if (actorPredicate && cursorPredicate) filters.and = `(or(${actorPredicate}),or(${cursorPredicate}))`;
      else if (actorPredicate) filters.or = `(${actorPredicate})`;
      else if (cursorPredicate) filters.or = `(${cursorPredicate})`;
      const rows = await query("researchEvents", {
        filters,
        order: order === "desc" ? "created_at.desc,event_id.desc" : TABLE_ORDERS.researchEvents,
        limit: page?.limit ?? null,
      });
      return rows.filter((row) => {
        const payload = row.payload ?? {};
        if (createdBefore && !(Date.parse(row.createdAt ?? "") <= Date.parse(createdBefore))) return false;
        if (objectType && !(payload.object_type === objectType || payload.entity_type === objectType)) return false;
        if (objectId) {
          const idKeys = objectId ? ["object_id", ...(objectType ? [`${objectType}_id`] : []), "claim_id", "question_id", "task_id", "project_id", "attempt_id", "evidence_id", "receipt_id"] : [];
          if (!idKeys.some((key) => payload[key] === objectId)) return false;
        }
        if (actorId && !EVENT_ACTOR_PAYLOAD_KEYS.some((key) => payload[key] === actorId)) return false;
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
