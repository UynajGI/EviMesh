import { assertProjectRoleForAction } from "./project-authorization.mjs";
import { assertTaskTransition } from "../../protocol/src/task-state.mjs";

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

function assertIfMatch(ifMatch, currentEtag) {
  if (typeof ifMatch !== "string" || ifMatch.trim().length === 0 || ifMatch.trim() !== currentEtag) {
    throw new TaskCommandError("If-Match does not match the current revision", "PRECONDITION_FAILED", 412);
  }
}

/** Append a Task revision without mutating historical revision rows. */
export async function reviseTask({
  repository,
  actorId,
  actorRole,
  taskId,
  ifMatch,
  currentEtag,
  questionId,
  title,
  description,
  inputs,
  outputs,
  acceptance,
  contextMode,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["getCurrentTaskRevision", "insertTaskRevision", "updateTask", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  taskId = requiredText(taskId, "task id");
  if (typeof currentEtag !== "string" || currentEtag.length === 0) throw new TaskCommandError("current ETag is required");
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getCurrentTaskRevision(taskId);
    if (!current) throw new TaskCommandError("current task revision not found", "TASK_REVISION_NOT_FOUND", 404);
    assertIfMatch(ifMatch, currentEtag);

    const nextQuestionId = questionId === undefined ? (current.questionId ?? null) : questionId === null ? null : requiredText(questionId, "question id");
    const next = {
      taskId,
      revision: current.revision + 1,
      supersedes: current.revision,
      state: current.state,
      title: title === undefined ? current.title : requiredText(title, "task title"),
      description: description === undefined ? current.description : requiredText(description, "task description"),
      inputs: inputs === undefined ? current.inputs : requiredJson(inputs, "task inputs"),
      outputs: outputs === undefined ? current.outputs : requiredJson(outputs, "task outputs"),
      acceptance: acceptance === undefined ? current.acceptance : requiredJson(acceptance, "task acceptance"),
      contextMode: contextMode === undefined ? current.contextMode : contextMode,
      questionId: nextQuestionId,
      createdBy: actorId,
    };
    if (!CONTEXT_MODES.has(next.contextMode)) throw new TaskCommandError(`unsupported context mode: ${String(next.contextMode)}`);
    const event = await eventFactory({
      eventType: "task.revised",
      payload: { entity_type: "task", task_id: taskId, revision: next.revision, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");
    const projected = { taskId, questionId: next.questionId, state: next.state };
    const persistedRevision = await transaction.insertTaskRevision(next);
    const persistedTask = await transaction.updateTask(taskId, projected);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { task: persistedTask ?? projected, revision: persistedRevision ?? next, event: persistedEvent ?? event };
  });
}

/** Append a Task revision for a validated lifecycle transition. */
export async function transitionTask({
  repository,
  actorId,
  actorRole,
  taskId,
  toState,
  ifMatch,
  currentEtag,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["getCurrentTaskRevision", "insertTaskRevision", "updateTask", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  taskId = requiredText(taskId, "task id");
  if (typeof currentEtag !== "string" || currentEtag.length === 0) throw new TaskCommandError("current ETag is required");
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getCurrentTaskRevision(taskId);
    if (!current) throw new TaskCommandError("current task revision not found", "TASK_REVISION_NOT_FOUND", 404);
    assertIfMatch(ifMatch, currentEtag);
    try {
      assertTaskTransition(current.state, toState);
    } catch (error) {
      throw new TaskCommandError(error.message, "STATE_TRANSITION_INVALID", 409);
    }
    const next = {
      ...current,
      revision: current.revision + 1,
      supersedes: current.revision,
      state: toState,
      createdBy: actorId,
    };
    delete next.createdAt;
    const event = await eventFactory({
      eventType: "task.state_changed",
      payload: { entity_type: "task", task_id: taskId, from_state: current.state, to_state: toState, revision: next.revision, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");
    const projected = { taskId, questionId: next.questionId ?? null, state: next.state };
    const persistedRevision = await transaction.insertTaskRevision(next);
    const persistedTask = await transaction.updateTask(taskId, projected);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { task: persistedTask ?? projected, revision: persistedRevision ?? next, event: persistedEvent ?? event };
  });
}
