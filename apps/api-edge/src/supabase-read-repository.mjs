const TABLES = Object.freeze({
  claims: "claims",
  frontierMembers: "frontier_members",
  frontierSnapshots: "frontier_snapshots",
  projectRevisions: "project_revisions",
  projects: "projects",
  questions: "questions",
  taskRevisions: "task_revisions",
  tasks: "tasks",
});

const DATA_API_PAGE_SIZE = 1_000;

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

function currentRevisionById(rows, idField) {
  const current = new Map();
  for (const row of rows) {
    const existing = current.get(row[idField]);
    if (!existing || row.revision > existing.revision) current.set(row[idField], row);
  }
  return current;
}

function metadataObjects(revision) {
  return [revision, revision?.inputs, revision?.outputs, revision?.acceptance]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value && typeof value === "object");
}

function taskTypeFor(revision) {
  for (const metadata of metadataObjects(revision)) {
    const value = metadata.taskType ?? metadata.type;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function taskTagsFor(revision) {
  const tags = new Set();
  for (const metadata of metadataObjects(revision)) {
    const values = metadata.tags ?? metadata.tag;
    for (const value of Array.isArray(values) ? values : [values]) {
      if (typeof value === "string" && value.trim()) tags.add(value.trim());
    }
  }
  return [...tags];
}

export function createSupabaseReadRepository({ url, publishableKey, fetchImpl = fetch } = {}) {
  const baseUrl = requiredString(url, "Supabase URL").replace(/\/$/, "");
  const apiKey = requiredString(publishableKey, "Supabase publishable key");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  async function list(table, filters = {}, { softDelete = true, order = "created_at.asc" } = {}) {
    const rows = [];
    for (let offset = 0; ; offset += DATA_API_PAGE_SIZE) {
      const endpoint = new URL(`${baseUrl}/rest/v1/${TABLES[table]}`);
      endpoint.searchParams.set("select", "*");
      if (softDelete) endpoint.searchParams.set("deleted_at", "is.null");
      endpoint.searchParams.set("order", order);
      for (const [column, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined) endpoint.searchParams.set(column, `eq.${value}`);
      }

      let response;
      try {
        response = await fetchImpl(endpoint, {
          headers: {
            accept: "application/json",
            apikey: apiKey,
            range: `${offset}-${offset + DATA_API_PAGE_SIZE - 1}`,
          },
        });
      } catch {
        throw new SupabaseReadRepositoryError("Supabase Data API request failed");
      }
      if (!response.ok) throw new SupabaseReadRepositoryError("Supabase Data API request failed");

      const payload = await response.json().catch(() => null);
      if (!Array.isArray(payload)) throw new SupabaseReadRepositoryError("Supabase Data API returned an invalid response");
      rows.push(...payload.map(mapRow));
      if (payload.length < DATA_API_PAGE_SIZE) return rows;
    }
  }

  return Object.freeze({
    listProjects: ({ state = null } = {}) => list("projects", { state }),
    async getProject(projectId) {
      return (await list("projects", { project_id: projectId }))[0] ?? null;
    },
    async getCurrentProjectRevision(projectId) {
      return (await list("projectRevisions", { project_id: projectId }, { softDelete: false, order: "revision.desc" }))[0] ?? null;
    },
    listFrontierSnapshots: ({ projectId } = {}) => list("frontierSnapshots", { project_id: projectId }, { softDelete: false }),
    listFrontierMembers: (snapshotId) => list("frontierMembers", { snapshot_id: snapshotId }, { softDelete: false }),
    listQuestions: ({ projectId = null, state = null } = {}) => list("questions", { project_id: projectId, state }),
    async listTasks({ projectId = null, status = null, type = null, tag = null } = {}) {
      const [rows, revisions, questions] = await Promise.all([
        list("tasks", { state: status }),
        list("taskRevisions", {}, { softDelete: false }),
        list("questions", projectId === null ? {} : { project_id: projectId }),
      ]);
      const currentRevisions = currentRevisionById(revisions, "taskId");
      const projectByQuestion = new Map(questions.map((question) => [question.questionId, question.projectId]));
      return rows.map((row) => {
        const revision = currentRevisions.get(row.taskId) ?? null;
        const tags = taskTagsFor(revision);
        return {
          ...row,
          ...(revision ?? {}),
          projectId: projectByQuestion.get(row.questionId) ?? null,
          type: taskTypeFor(revision),
          tags,
          tag: tags[0] ?? null,
        };
      }).filter((row) => matchesOptional(row.projectId, projectId)
        && matchesOptional(row.type, type)
        && includesTag(row, tag));
    },
    async listClaims({ projectId = null, status = null, tag = null } = {}) {
      const rows = await list("claims", { state: status });
      return rows.filter((row) => matchesOptional(row.projectId, projectId) && includesTag(row, tag));
    },
  });
}
