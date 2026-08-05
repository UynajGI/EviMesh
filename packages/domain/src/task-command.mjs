import { assertProjectRoleForAction } from "./project-authorization.mjs";

const CONTEXT_MODES = new Set(["frontier", "full_trace", "adversarial", "blind"]);

export class TaskCommandError extends Error {
  constructor(message, code = "TASK_INVALID", status = 400) {
    super(message);
    this.name = "TaskCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TaskCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredJson(value, field) {
  if (value === undefined || value === null || typeof value !== "object") throw new TaskCommandError(`${field} must be a JSON object or array`);
  return value;
}

/** Create a Task and its first immutable revision in one transaction. */
export async function createTask({
  repository,
  actorId,
  actorRole,
  taskId,
  questionId = null,
  title,
  description,
  inputs = [],
  outputs,
  acceptance,
  contextMode,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["insertTask", "insertTaskRevision", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  taskId = requiredText(taskId, "task id");
  if (questionId !== null) questionId = requiredText(questionId, "question id");
  title = requiredText(title, "task title");
  description = requiredText(description, "task description");
  inputs = requiredJson(inputs, "task inputs");
  outputs = requiredJson(outputs, "task outputs");
  acceptance = requiredJson(acceptance, "task acceptance");
  if (!CONTEXT_MODES.has(contextMode)) throw new TaskCommandError(`unsupported context mode: ${String(contextMode)}`);
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  const task = { taskId, questionId, state: "draft", createdBy: actorId };
  const revision = {
    taskId,
    revision: 1,
    supersedes: null,
    state: "draft",
    title,
    description,
    inputs,
    outputs,
    acceptance,
    contextMode,
    questionId,
    createdBy: actorId,
  };
  const event = await eventFactory({
    eventType: "task.created",
    payload: { entity_type: "task", task_id: taskId, question_id: questionId, revision: 1, actor_id: actorId },
  });
  if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");

  return repository.withTransaction(async (transaction) => {
    const persistedTask = await transaction.insertTask(task);
    const persistedRevision = await transaction.insertTaskRevision(revision);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { task: persistedTask ?? task, revision: persistedRevision ?? revision, event: persistedEvent ?? event };
  });
}
