const TABLES = Object.freeze({
  claims: "claims",
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
const PRIMARY_KEYS = Object.freeze({ claims: "claim_id", projects: "project_id", questions: "question_id", tasks: "task_id" });

export function createSupabaseReadRepository({ url, publishableKey, fetchImpl = fetch } = {}) {
  const baseUrl = requiredString(url, "Supabase URL").replace(/\/$/, "");
  const apiKey = requiredString(publishableKey, "Supabase publishable key");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  async function list(table, filters = {}) {
    const endpoint = new URL(`${baseUrl}/rest/v1/${TABLES[table]}`);
    endpoint.searchParams.set("select", "*");
    endpoint.searchParams.set("deleted_at", "is.null");
    endpoint.searchParams.set("order", `created_at.desc,${PRIMARY_KEYS[table]}.desc`);
    for (const [column, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) endpoint.searchParams.set(column, `eq.${value}`);
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

  return Object.freeze({
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
  });
}
