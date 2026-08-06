import { assertProjectRoleForAction } from "./project-authorization.mjs";
import { assertContextMode } from "../../protocol/src/context-mode.mjs";
import { ContextBundleHashError, hashContextBundle } from "../../protocol/src/context-bundle-hash.mjs";

export class ContextBundleCommandError extends Error {
  constructor(message, code = "CONTEXT_BUNDLE_INVALID", status = 400) {
    super(message);
    this.name = "ContextBundleCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ContextBundleCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new ContextBundleCommandError(`${field} must be a positive integer`);
  return value;
}

function requiredStorageUri(value) {
  value = requiredText(value, "storage URI");
  try {
    const parsed = new URL(value);
    if (!parsed.protocol || !parsed.hostname) throw new TypeError("missing authority");
  } catch {
    throw new ContextBundleCommandError("storage URI must be an absolute URI");
  }
  return value;
}

function bundleIdentity(bundle) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) throw new ContextBundleCommandError("context bundle must be a JSON object");
  const task = bundle.task;
  const frontier = bundle.frontier;
  const taskId = requiredText(task?.taskId, "bundle task id");
  const taskRevision = positiveInteger(task?.revision, "bundle task revision");
  const frontierSnapshotId = requiredText(frontier?.snapshotId, "bundle frontier snapshot id");
  try { assertContextMode(bundle.mode); } catch { throw new ContextBundleCommandError("bundle mode is unsupported"); }
  let contentHash;
  try { contentHash = hashContextBundle(bundle); } catch (error) {
    if (error instanceof ContextBundleHashError) throw new ContextBundleCommandError(error.message);
    throw error;
  }
  return { taskId, taskRevision, frontierSnapshotId, mode: bundle.mode, contentHash };
}

/** Persist a hash-addressed, revision-pinned ContextBundle and its ResearchEvent atomically. */
export async function createContextBundle({ repository, actorId, actorRole, contextBundleId, bundle, storageUri, eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ContextBundleCommandError("repository withTransaction is required");
  for (const method of ["getTaskRevision", "getFrontierSnapshot", "insertContextBundle", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ContextBundleCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  contextBundleId = requiredText(contextBundleId, "context bundle id");
  storageUri = requiredStorageUri(storageUri);
  if (typeof eventFactory !== "function") throw new ContextBundleCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "contributor" });
  const identity = bundleIdentity(bundle);
  const manifest = Object.freeze({
    schema: "evimesh.context-bundle.v1",
    contextBundleId,
    taskId: identity.taskId,
    taskRevision: identity.taskRevision,
    frontierSnapshotId: identity.frontierSnapshotId,
    mode: identity.mode,
    contentHash: identity.contentHash,
    storageUri,
  });
  return repository.withTransaction(async (transaction) => {
    if (!await transaction.getTaskRevision(identity.taskId, identity.taskRevision)) {
      throw new ContextBundleCommandError("task revision not found", "TASK_REVISION_NOT_FOUND", 404);
    }
    if (!await transaction.getFrontierSnapshot(identity.frontierSnapshotId)) {
      throw new ContextBundleCommandError("frontier snapshot not found", "FRONTIER_SNAPSHOT_NOT_FOUND", 404);
    }
    const event = await eventFactory({
      eventType: "context_bundle.created",
      payload: { entity_type: "context_bundle", context_bundle_id: contextBundleId, task_id: identity.taskId, task_revision: identity.taskRevision, frontier_snapshot_id: identity.frontierSnapshotId, mode: identity.mode, content_hash: identity.contentHash, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new ContextBundleCommandError("eventFactory must return an event object");
    const contextBundle = { contextBundleId, taskId: identity.taskId, taskRevision: identity.taskRevision, frontierSnapshotId: identity.frontierSnapshotId, mode: identity.mode, manifest, contentHash: identity.contentHash, storageUri };
    return {
      contextBundle: await transaction.insertContextBundle(contextBundle) ?? contextBundle,
      event: await transaction.appendResearchEvent(event) ?? event,
    };
  });
}
