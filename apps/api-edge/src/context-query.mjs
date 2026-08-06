import { assertContextMode } from "../../../packages/protocol/src/context-mode.mjs";

export class ContextQueryError extends Error {
  constructor(message, code = "CONTEXT_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "ContextQueryError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ContextQueryError(`${field} must be a non-empty string`);
  return value.trim();
}

/** Return the one immutable ContextBundle for a Task and requested mode. */
export async function getTaskContext({ repository, taskId, mode } = {}) {
  if (!repository || typeof repository.getContextBundleForTask !== "function") {
    throw new ContextQueryError("repository getContextBundleForTask is required");
  }
  taskId = requiredText(taskId, "task id");
  try { assertContextMode(mode); } catch { throw new ContextQueryError("context mode is unsupported"); }
  const contextBundle = await repository.getContextBundleForTask({ taskId, mode });
  if (!contextBundle) throw new ContextQueryError("context bundle not found", "CONTEXT_BUNDLE_NOT_FOUND", 404);
  if (contextBundle.taskId !== taskId || contextBundle.mode !== mode) {
    throw new ContextQueryError("repository returned a context bundle for another task or mode", "CONTEXT_BUNDLE_MISMATCH", 500);
  }
  return contextBundle;
}
