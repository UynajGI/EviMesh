import { paginate } from "./pagination.mjs";

export class TaskQueryError extends Error {
  constructor(message, code = "TASK_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "TaskQueryError";
    this.code = code;
    this.status = status;
  }
}

function optionalFilter(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) throw new TaskQueryError(`${field} must be a non-empty string or null`);
  return value.trim();
}

function requiredId(value) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TaskQueryError("task id must be a non-empty string");
  return value.trim();
}

export async function listTasks({ repository, projectId = null, status = null, type = null, tag = null, limit = 20, cursor = null } = {}) {
  if (!repository || typeof repository.listTasks !== "function") throw new TaskQueryError("repository listTasks is required");
  const filters = {
    projectId: optionalFilter(projectId, "project id"),
    status: optionalFilter(status, "task status"),
    type: optionalFilter(type, "task type"),
    tag: optionalFilter(tag, "task tag"),
  };
  const tasks = await repository.listTasks(filters);
  return paginate(tasks, { limit, cursor, getKey: (task) => ({ createdAt: task.createdAt, id: task.taskId }) });
}

export async function getTask({ repository, taskId } = {}) {
  taskId = requiredId(taskId);
  if (!repository || typeof repository.getTask !== "function" || typeof repository.getCurrentTaskRevision !== "function" || typeof repository.listTaskDependencies !== "function" || typeof repository.listCurrentTaskLeases !== "function") {
    throw new TaskQueryError("repository task detail methods are required");
  }
  const task = await repository.getTask(taskId);
  if (!task) throw new TaskQueryError("task not found", "TASK_NOT_FOUND", 404);
  const [currentRevision, dependencies, leases] = await Promise.all([
    repository.getCurrentTaskRevision(taskId),
    repository.listTaskDependencies(taskId),
    repository.listCurrentTaskLeases(taskId),
  ]);
  if (!currentRevision) throw new TaskQueryError("current task revision not found", "TASK_REVISION_NOT_FOUND", 500);
  return { task, currentRevision, dependencies, leases };
}
