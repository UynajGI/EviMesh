const TABLES = Object.freeze({
  actors: "actors",
  actorProfiles: "actor_profiles",
  apiTokens: "api_tokens",
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
const TABLE_ORDERS = Object.freeze({
  actors: "created_at.desc,actor_id.desc",
  actorProfiles: "actor_id.asc",
  apiTokens: "created_at.desc,token_id.desc",
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

/* Only mutable-projection tables carry lifecycle columns; the soft-delete
 * filter must not be applied to revision, event, or junction fact tables. */
const SOFT_DELETE_TABLES = new Set(["actors", "actorProfiles", "artifacts", "attempts", "challenges", "claims", "projects", "questions"]);

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
      if (column === "and") endpoint.searchParams.set("and", String(value));
      else endpoint.searchParams.set(column, filterValue(value));
    }

    const rows = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let response;
      try {
        response = await fetchImpl(endpoint, { headers: { accept: "application/json", apikey: apiKey, Range: `${offset}-${offset + PAGE_SIZE - 1}`, "Range-Unit": "items" } });
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
      if (payload.length < PAGE_SIZE || (Number.isInteger(limit) && limit > 0)) return rows;
    }
  }

  async function list(table, filters = {}) {
    return query(table, { filters });
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

  async function claimGraph({ claimId, maxDepth, direction }) {
    const [relations, claims] = await Promise.all([
      list("claimRelations", { relation_type: "depends_on" }),
      list("claims"),
    ]);
    const neighbours = new Map();
    for (const relation of relations) {
      const from = direction === "upstream" ? relation.sourceClaimId : relation.targetClaimId;
      const to = direction === "upstream" ? relation.targetClaimId : relation.sourceClaimId;
      const values = neighbours.get(from) ?? [];
      values.push(to);
      neighbours.set(from, values);
    }
    const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
    const visited = new Set([claimId]);
    const queue = [{ claimId, depth: 0, path: [claimId] }];
    const nodes = [];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.depth >= maxDepth) continue;
      for (const nextId of neighbours.get(current.claimId) ?? []) {
        if (visited.has(nextId)) continue;
        visited.add(nextId);
        const next = { claimId: nextId, depth: current.depth + 1, path: [...current.path, nextId] };
        queue.push(next);
        nodes.push({ ...(claimById.get(nextId) ?? {}), ...next });
      }
    }
    return nodes;
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
      if (type !== null) unsupportedFilter("task type");
      if (tag !== null) unsupportedFilter("task tag");
      const rows = await list("tasks", { state: status });
      const questionIds = await questionIdsForProject(projectId);
      return questionIds === null ? rows : rows.filter((row) => questionIds.has(row.questionId));
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
    async listResearchEvents({ objectType = null, objectId = null, actorId = null, eventType = null, createdAfter = null, createdBefore = null } = {}) {
      const filters = {};
      if (eventType) filters.event_type = eventType;
      if (createdAfter) filters.created_at = { op: "gte", value: createdAfter };
      const rows = await list("researchEvents", filters);
      return rows.filter((row) => {
        const payload = row.payload ?? {};
        if (createdBefore && !(Date.parse(row.createdAt ?? "") <= Date.parse(createdBefore))) return false;
        if (objectType && !(payload.object_type === objectType || payload.entity_type === objectType)) return false;
        if (objectId) {
          const idKeys = objectId ? ["object_id", ...(objectType ? [`${objectType}_id`] : []), "claim_id", "question_id", "task_id", "project_id", "attempt_id", "evidence_id", "receipt_id"] : [];
          if (!idKeys.some((key) => payload[key] === objectId)) return false;
        }
        if (actorId && payload.actor_id !== actorId) return false;
        return true;
      });
    },
    async listResearchEventRange({ firstEventId, lastEventId }) {
      const rows = await list("researchEvents");
      const first = rows.findIndex((row) => row.eventId === firstEventId);
      const last = rows.findIndex((row) => row.eventId === lastEventId);
      if (first < 0 || last < 0 || last < first) return [];
      return rows.slice(first, last + 1);
    },
    listResearchEventsByIds: (eventIds) => list("researchEvents", { event_id: eventIds }),

    /* ---- provenance ---- */
    async getObjectRevision({ objectType, objectId, revision = null }) {
      const entry = REVISION_TABLES[objectType];
      if (!entry) return null;
      const [table, idColumn] = entry;
      if (revision === null || revision === undefined) return currentRevision(table, idColumn, objectId);
      return getOne(table, { [idColumn]: objectId, revision });
    },

    /* ---- api tokens (secret hash never selected) ---- */
    listApiTokensByActor: (actorId) =>
      query("apiTokens", {
        filters: { actor_id: actorId },
        select: "token_id,token_prefix,scopes,expires_at,revoked_at,last_used_at",
      }),
  });
}
