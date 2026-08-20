const TABLES = Object.freeze({
  actors: "actors",
  actorProfiles: "actor_profiles",
  claims: "claims",
  claimRelations: "claim_relations",
  contributionEdges: "contribution_edges",
  contributionStatements: "contribution_statements",
  projects: "projects",
  questions: "questions",
  tasks: "tasks",
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
  claims: "created_at.desc,claim_id.desc",
  claimRelations: "created_at.asc,source_claim_id.asc,target_claim_id.asc,relation_type.asc",
  contributionEdges: "statement_id.asc,edge_type.asc",
  contributionStatements: "created_at.desc,statement_id.desc",
  projects: "created_at.desc,project_id.desc",
  questions: "created_at.desc,question_id.desc",
  tasks: "created_at.desc,task_id.desc",
});

/** PostgREST filter value: `eq.x` for scalars, `in.(a,b)` for arrays. */
function filterValue(value) {
  if (Array.isArray(value)) return `in.(${value.map((entry) => String(entry).replaceAll(",", "").replaceAll(")", "")).join(",")})`;
  return `eq.${value}`;
}

/* Append-only fact tables carry no lifecycle columns; the soft-delete
 * filter must not be applied to them. */
const TABLES_WITHOUT_SOFT_DELETE = new Set(["contributionEdges", "contributionStatements"]);

export function createSupabaseReadRepository({ url, publishableKey, fetchImpl = fetch } = {}) {
  const baseUrl = requiredString(url, "Supabase URL").replace(/\/$/, "");
  const apiKey = requiredString(publishableKey, "Supabase publishable key");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  async function list(table, filters = {}) {
    const endpoint = new URL(`${baseUrl}/rest/v1/${TABLES[table]}`);
    endpoint.searchParams.set("select", "*");
    if (!TABLES_WITHOUT_SOFT_DELETE.has(table)) endpoint.searchParams.set("deleted_at", "is.null");
    endpoint.searchParams.set("order", TABLE_ORDERS[table]);
    for (const [column, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) endpoint.searchParams.set(column, filterValue(value));
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
      if (payload.length < PAGE_SIZE) return rows;
    }
  }

  async function questionIdsForProject(projectId) {
    if (projectId === null) return null;
    return new Set((await list("questions", { project_id: projectId })).map((question) => question.questionId));
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

  return Object.freeze({
    /* Actor directory + identity card reads (M13.8 data gates round). All
     * read through the same public-table REST surface as the other lists. */
    listActors: async () => list("actors"),
    async getActor(actorId) {
      return (await list("actors", { actor_id: actorId }))[0] ?? null;
    },
    async getActorProfile(actorId) {
      return (await list("actorProfiles", { actor_id: actorId }))[0] ?? null;
    },
    listContributionStatements: (actorId) => list("contributionStatements", { actor_id: actorId }),
    listContributionEdges: (statementIds) => list("contributionEdges", { statement_id: statementIds }),
    listProjects: ({ state = null } = {}) => list("projects", { state }),
    listQuestions: ({ projectId = null, state = null } = {}) => list("questions", { project_id: projectId, state }),
    async listTasks({ projectId = null, status = null, type = null, tag = null } = {}) {
      if (type !== null) unsupportedFilter("task type");
      if (tag !== null) unsupportedFilter("task tag");
      const rows = await list("tasks", { state: status });
      const questionIds = await questionIdsForProject(projectId);
      return questionIds === null ? rows : rows.filter((row) => questionIds.has(row.questionId));
    },
    async listClaims({ projectId = null, status = null, tag = null } = {}) {
      if (tag !== null) unsupportedFilter("claim tag");
      const rows = await list("claims", { state: status });
      const questionIds = await questionIdsForProject(projectId);
      return questionIds === null ? rows : rows.filter((row) => questionIds.has(row.questionId));
    },
    getClaimUpstreamGraph: ({ claimId, maxDepth }) => claimGraph({ claimId, maxDepth, direction: "upstream" }),
    getClaimDownstreamGraph: ({ claimId, maxDepth }) => claimGraph({ claimId, maxDepth, direction: "downstream" }),
  });
}
