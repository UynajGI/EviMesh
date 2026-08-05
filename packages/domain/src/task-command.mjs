import { assertProjectRoleForAction } from "./project-authorization.mjs";
import { assertTaskTransition } from "../../protocol/src/task-state.mjs";
import { assertDependencyAddition } from "../../protocol/src/dependency-graph.mjs";
import { assertContextMode } from "../../protocol/src/context-mode.mjs";
import { assertAttemptTransition } from "../../protocol/src/attempt-state.mjs";

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

/** Add an acyclic Task dependency and its audit event atomically. */
export async function addTaskDependency({
  repository,
  actorId,
  actorRole,
  sourceTaskId,
  targetTaskId,
  dependencyType = "depends_on",
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["listTaskDependencies", "insertTaskDependency", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  sourceTaskId = requiredText(sourceTaskId, "source task id");
  targetTaskId = requiredText(targetTaskId, "target task id");
  if (dependencyType !== "depends_on") throw new TaskCommandError(`unsupported task dependency type: ${String(dependencyType)}`);
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const existing = await transaction.listTaskDependencies();
    const edges = (existing ?? []).map((dependency) => ({
      type: dependency.dependencyType ?? dependency.type ?? "depends_on",
      source: dependency.sourceTaskId ?? dependency.source,
      target: dependency.targetTaskId ?? dependency.target,
    }));
    if (edges.some((edge) => edge.source === sourceTaskId && edge.target === targetTaskId && edge.type === dependencyType)) {
      throw new TaskCommandError("task dependency already exists", "DEPENDENCY_EXISTS", 409);
    }
    try {
      assertDependencyAddition(edges, sourceTaskId, targetTaskId);
    } catch (error) {
      throw new TaskCommandError(error.message, "DEPENDENCY_CYCLE", 409);
    }
    const dependency = { sourceTaskId, targetTaskId, dependencyType, createdBy: actorId };
    const event = await eventFactory({
      eventType: "task.dependency_created",
      payload: { entity_type: "task_dependency", source_task_id: sourceTaskId, target_task_id: targetTaskId, dependency_type: dependencyType, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");
    const persistedDependency = await transaction.insertTaskDependency(dependency);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { dependency: persistedDependency ?? dependency, event: persistedEvent ?? event };
  });
}

/** Acquire an exclusive, time-bounded Task lease. */
export async function acquireTaskLease({
  repository,
  actorId,
  actorRole,
  taskId,
  leaseDurationMs = 15 * 60 * 1000,
  now = new Date(),
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["listCurrentTaskLeases", "insertTaskLease", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  taskId = requiredText(taskId, "task id");
  if (!Number.isInteger(leaseDurationMs) || leaseDurationMs <= 0) throw new TaskCommandError("lease duration must be a positive integer");
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new TaskCommandError("lease time is invalid");
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const activeLeases = await transaction.listCurrentTaskLeases(taskId);
    const active = (activeLeases ?? []).find((lease) => {
      const expiresAt = new Date(lease.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt > nowDate.getTime();
    });
    if (active) {
      const code = active.holderActorId === actorId ? "LEASE_ALREADY_HELD" : "LEASE_CONFLICT";
      throw new TaskCommandError("task already has an active lease", code, 409);
    }
    const lease = {
      taskId,
      holderActorId: actorId,
      acquiredAt: nowDate.toISOString(),
      expiresAt: new Date(nowDate.getTime() + leaseDurationMs).toISOString(),
      lastRenewedAt: null,
    };
    const event = await eventFactory({
      eventType: "task.lease_acquired",
      payload: { entity_type: "task_lease", task_id: taskId, holder_actor_id: actorId, expires_at: lease.expiresAt, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");
    const persistedLease = await transaction.insertTaskLease(lease);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { lease: persistedLease ?? lease, event: persistedEvent ?? event };
  });
}

/** Extend an active Task lease only when held by the authenticated Actor. */
export async function renewTaskLease({
  repository,
  actorId,
  actorRole,
  taskId,
  extensionMs = 15 * 60 * 1000,
  now = new Date(),
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["listCurrentTaskLeases", "updateTaskLease", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  taskId = requiredText(taskId, "task id");
  if (!Number.isInteger(extensionMs) || extensionMs <= 0) throw new TaskCommandError("lease extension must be a positive integer");
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new TaskCommandError("lease time is invalid");
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const lease = (await transaction.listCurrentTaskLeases(taskId) ?? []).find((candidate) => candidate.holderActorId === actorId);
    if (!lease) throw new TaskCommandError("task lease not found for actor", "LEASE_NOT_FOUND", 404);
    const previousExpiryMs = new Date(lease.expiresAt).getTime();
    if (!Number.isFinite(previousExpiryMs) || previousExpiryMs <= nowDate.getTime()) {
      throw new TaskCommandError("task lease has expired", "LEASE_EXPIRED", 409);
    }
    const updated = {
      ...lease,
      taskId,
      holderActorId: actorId,
      expiresAt: new Date(previousExpiryMs + extensionMs).toISOString(),
      lastRenewedAt: nowDate.toISOString(),
    };
    const event = await eventFactory({
      eventType: "task.lease_renewed",
      payload: { entity_type: "task_lease", task_id: taskId, holder_actor_id: actorId, previous_expires_at: lease.expiresAt, expires_at: updated.expiresAt, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");
    const persistedLease = await transaction.updateTaskLease(taskId, actorId, { expiresAt: updated.expiresAt, lastRenewedAt: updated.lastRenewedAt });
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { lease: persistedLease ?? updated, event: persistedEvent ?? event };
  });
}

/** Soft-delete expired Task leases and record cleanup events atomically. */
export async function expireTaskLeases({
  repository,
  actorId,
  actorRole,
  taskId = null,
  now = new Date(),
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["listCurrentTaskLeases", "updateTaskLease", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  if (taskId !== null) taskId = requiredText(taskId, "task id");
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new TaskCommandError("lease time is invalid");
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const leases = await transaction.listCurrentTaskLeases(taskId);
    const expired = (leases ?? []).filter((lease) => {
      const expiresAt = new Date(lease.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt <= nowDate.getTime();
    });
    const results = [];
    for (const lease of expired) {
      const deletedAt = nowDate.toISOString();
      const updated = await transaction.updateTaskLease(lease.taskId, lease.holderActorId, { deletedAt });
      const event = await eventFactory({
        eventType: "task.lease_expired",
        payload: { entity_type: "task_lease", task_id: lease.taskId, holder_actor_id: lease.holderActorId, expires_at: lease.expiresAt, expired_at: deletedAt, actor_id: actorId },
      });
      if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");
      const persistedEvent = await transaction.appendResearchEvent(event);
      results.push({ lease: updated ?? { ...lease, deletedAt }, event: persistedEvent ?? event });
    }
    return results;
  });
}

/** Create an active Attempt after binding it to the Task's context bundle. */
export async function createAttempt({
  repository,
  actorId,
  actorRole,
  attemptId,
  taskId,
  contextBundleId,
  contextMode,
  now = new Date(),
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["getContextBundle", "insertAttempt", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  attemptId = requiredText(attemptId, "attempt id");
  taskId = requiredText(taskId, "task id");
  contextBundleId = requiredText(contextBundleId, "context bundle id");
  try {
    assertContextMode(contextMode);
  } catch (error) {
    throw new TaskCommandError(error.message, "CONTEXT_MODE_INVALID", 400);
  }
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new TaskCommandError("attempt time is invalid");
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "contributor" });

  return repository.withTransaction(async (transaction) => {
    const context = await transaction.getContextBundle(contextBundleId);
    if (!context) throw new TaskCommandError("context bundle not found", "CONTEXT_BUNDLE_NOT_FOUND", 404);
    if (context.taskId !== taskId || context.mode !== contextMode) {
      throw new TaskCommandError("context bundle does not match task or mode", "CONTEXT_BUNDLE_MISMATCH", 409);
    }
    const attempt = {
      attemptId,
      taskId,
      actorId,
      state: "active",
      startedAt: nowDate.toISOString(),
      finishedAt: null,
    };
    const event = await eventFactory({
      eventType: "attempt.created",
      payload: { entity_type: "attempt", attempt_id: attemptId, task_id: taskId, actor_id: actorId, context_bundle_id: contextBundleId, context_mode: contextMode },
    });
    if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");
    const persistedAttempt = await transaction.insertAttempt(attempt);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { attempt: persistedAttempt ?? attempt, contextBundle: context, event: persistedEvent ?? event };
  });
}

/** Transition an Attempt and set its terminal timestamp when applicable. */
export async function transitionAttempt({
  repository,
  actorId,
  actorRole,
  attemptId,
  toState,
  now = new Date(),
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new TaskCommandError("repository withTransaction is required");
  for (const method of ["getAttempt", "updateAttempt", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new TaskCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  attemptId = requiredText(attemptId, "attempt id");
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new TaskCommandError("attempt time is invalid");
  if (typeof eventFactory !== "function") throw new TaskCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "contributor" });

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getAttempt(attemptId);
    if (!current) throw new TaskCommandError("attempt not found", "ATTEMPT_NOT_FOUND", 404);
    if (current.actorId !== actorId) throw new TaskCommandError("attempt belongs to another actor", "ATTEMPT_FORBIDDEN", 403);
    try {
      assertAttemptTransition(current.state, toState);
    } catch (error) {
      throw new TaskCommandError(error.message, "STATE_TRANSITION_INVALID", 409);
    }
    const updated = {
      ...current,
      state: toState,
      finishedAt: toState === "submitted" || toState === "abandoned" ? nowDate.toISOString() : null,
    };
    const event = await eventFactory({
      eventType: "attempt.state_changed",
      payload: { entity_type: "attempt", attempt_id: attemptId, from_state: current.state, to_state: toState, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new TaskCommandError("eventFactory must return an event object");
    const persistedAttempt = await transaction.updateAttempt(attemptId, { state: updated.state, finishedAt: updated.finishedAt });
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { attempt: persistedAttempt ?? updated, event: persistedEvent ?? event };
  });
}
