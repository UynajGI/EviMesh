const TABLES = Object.freeze({
  claims: "claims",
  claimRevisions: "claim_revisions",
  frontierMembers: "frontier_members",
  frontierSnapshots: "frontier_snapshots",
  projectRevisions: "project_revisions",
  projects: "projects",
  questions: "questions",
  taskDependencies: "task_dependencies",
  taskLeases: "task_leases",
  taskRevisions: "task_revisions",
  tasks: "tasks",
});

const DATA_API_PAGE_SIZE = 1_000;
const TABLE_ORDERS = Object.freeze({
  claims: "created_at.asc,claim_id.asc",
  claimRevisions: "revision.asc,claim_id.asc",
  frontierMembers: "created_at.asc,snapshot_id.asc,claim_id.asc,claim_revision.asc",
  frontierSnapshots: "created_at.asc,snapshot_id.asc",
  projectRevisions: "revision.asc,project_id.asc",
  projects: "created_at.asc,project_id.asc",
  questions: "created_at.asc,question_id.asc",
  taskDependencies: "created_at.asc,source_task_id.asc,target_task_id.asc",
  taskLeases: "created_at.asc,task_id.asc,holder_actor_id.asc",
  taskRevisions: "revision.asc,task_id.asc",
  tasks: "created_at.asc,task_id.asc",
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

function currentRevisionById(rows, idField) {
  const current = new Map();
  for (const row of rows) {
    const existing = current.get(row[idField]);
    if (!existing || row.revision > existing.revision) current.set(row[idField], row);
  }
  return current;
}

function taskTypeFor(revision) {
  return typeof revision?.taskType === "string" && revision.taskType.trim() ? revision.taskType.trim() : null;
}

function taskTagsFor(revision) {
  return Array.isArray(revision?.tags)
    ? [...new Set(revision.tags.filter((tag) => typeof tag === "string" && tag.trim()).map((tag) => tag.trim()))]
    : [];
}

export function createSupabaseReadRepository({ url, publishableKey, fetchImpl = fetch } = {}) {
  const baseUrl = requiredString(url, "Supabase URL").replace(/\/$/, "");
  const apiKey = requiredString(publishableKey, "Supabase publishable key");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  async function list(table, filters = {}, { softDelete = true, order = TABLE_ORDERS[table] } = {}) {
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
    async getTask(taskId) {
      return (await list("tasks", { task_id: taskId }))[0] ?? null;
    },
    async getCurrentTaskRevision(taskId) {
      return (await list("taskRevisions", { task_id: taskId }, { softDelete: false, order: "revision.desc" }))[0] ?? null;
    },
    listTaskDependencies: (taskId) => list("taskDependencies", { source_task_id: taskId }),
    listCurrentTaskLeases: (taskId) => list("taskLeases", { task_id: taskId }),
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
    async getClaim(claimId) {
      return (await list("claims", { claim_id: claimId }))[0] ?? null;
    },
    async getCurrentClaimRevision(claimId) {
      return (await list("claimRevisions", { claim_id: claimId }, { softDelete: false, order: "revision.desc" }))[0] ?? null;
    },
    async listClaims({ projectId = null, status = null, tag = null } = {}) {
      const rows = await list("claims", { state: status });
      return rows.filter((row) => matchesOptional(row.projectId, projectId) && includesTag(row, tag));
    },
  });
}
