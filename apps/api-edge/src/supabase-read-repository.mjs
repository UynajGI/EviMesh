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
    throw new SupabaseReadRepositoryError(`${name} is required`);
  }
  return value.trim();
}

function camelCaseKey(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelCaseKey(key), value]));
}

function includesTag(row, tag) {
  if (tag === null) return true;
  if (row.tag === tag) return true;
  return Array.isArray(row.tags) && row.tags.includes(tag);
}

function matchesOptional(value, expected) {
  return expected === null || value === expected;
}

export function createSupabaseReadRepository({ url, publishableKey, fetchImpl = fetch } = {}) {
  const baseUrl = requiredString(url, "Supabase URL").replace(/\/$/, "");
  const apiKey = requiredString(publishableKey, "Supabase publishable key");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  async function list(table, filters = {}) {
    const endpoint = new URL(`${baseUrl}/rest/v1/${TABLES[table]}`);
    endpoint.searchParams.set("select", "*");
    endpoint.searchParams.set("deleted_at", "is.null");
    endpoint.searchParams.set("order", "created_at.desc");
    for (const [column, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) endpoint.searchParams.set(column, `eq.${value}`);
    }

    let response;
    try {
      response = await fetchImpl(endpoint, { headers: { accept: "application/json", apikey: apiKey } });
    } catch {
      throw new SupabaseReadRepositoryError("Supabase Data API request failed");
    }
    if (!response.ok) throw new SupabaseReadRepositoryError("Supabase Data API request failed");
    const payload = await response.json().catch(() => null);
    if (!Array.isArray(payload)) throw new SupabaseReadRepositoryError("Supabase Data API returned an invalid response");
    return payload.map(mapRow);
  }

  return Object.freeze({
    listProjects: ({ state = null } = {}) => list("projects", { state }),
    listQuestions: ({ projectId = null, state = null } = {}) => list("questions", { project_id: projectId, state }),
    async listTasks({ projectId = null, status = null, type = null, tag = null } = {}) {
      const rows = await list("tasks", { state: status });
      return rows.filter((row) => matchesOptional(row.projectId, projectId)
        && matchesOptional(row.type ?? row.taskType, type) && includesTag(row, tag));
    },
    async listClaims({ projectId = null, status = null, tag = null } = {}) {
      const rows = await list("claims", { state: status });
      return rows.filter((row) => matchesOptional(row.projectId, projectId) && includesTag(row, tag));
    },
  });
}
