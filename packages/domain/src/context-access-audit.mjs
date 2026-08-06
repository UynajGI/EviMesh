export class ContextAccessAuditError extends Error {
  constructor(message, code = "CONTEXT_ACCESS_AUDIT_INVALID") {
    super(message);
    this.name = "ContextAccessAuditError";
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ContextAccessAuditError(`${field} must be a non-empty string`);
  return value.trim();
}

function bundleIdentity(value) {
  if (!value || typeof value !== "object") throw new ContextAccessAuditError("context bundle is required");
  return {
    contextBundleId: requiredText(value.contextBundleId, "context bundle id"),
    taskId: requiredText(value.taskId, "context bundle task id"),
    mode: requiredText(value.mode, "context bundle mode"),
    contentHash: requiredText(value.contentHash, "context bundle content hash"),
  };
}

/**
 * Append an audit ResearchEvent only when the authorization layer marks a
 * ContextBundle access as restricted. Authorization itself stays outside this
 * hook so policy can evolve without changing the immutable event contract.
 */
export async function recordContextBundleAccess({ repository, actorId, contextBundle, accessRestricted, reason = "download", eventFactory } = {}) {
  if (typeof accessRestricted !== "boolean") throw new ContextAccessAuditError("accessRestricted must be a boolean");
  if (!accessRestricted) return Object.freeze({ audited: false });
  if (!repository || typeof repository.withTransaction !== "function" || typeof repository.appendResearchEvent !== "function") {
    throw new ContextAccessAuditError("repository audit methods are required");
  }
  actorId = requiredText(actorId, "actor id");
  reason = requiredText(reason, "access reason");
  if (typeof eventFactory !== "function") throw new ContextAccessAuditError("eventFactory is required");
  const identity = bundleIdentity(contextBundle);
  return repository.withTransaction(async (transaction) => {
    const event = await eventFactory({
      eventType: "context_bundle.accessed",
      payload: { entity_type: "context_bundle", context_bundle_id: identity.contextBundleId, task_id: identity.taskId, mode: identity.mode, content_hash: identity.contentHash, actor_id: actorId, access_reason: reason },
    });
    if (!event || typeof event !== "object") throw new ContextAccessAuditError("eventFactory must return an event object");
    return Object.freeze({ audited: true, event: await transaction.appendResearchEvent(event) ?? event });
  });
}
