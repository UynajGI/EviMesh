import { assertProjectRoleForAction } from "./project-authorization.mjs";
import { createVerificationPolicy } from "../../protocol/src/verification-policy.mjs";

export class VerificationPolicyCommandError extends Error {
  constructor(message, code = "VERIFICATION_POLICY_INVALID", status = 400) { super(message); this.name = "VerificationPolicyCommandError"; this.code = code; this.status = status; }
}
function requiredText(value, field) { if (typeof value !== "string" || value.trim().length === 0) throw new VerificationPolicyCommandError(`${field} must be a non-empty string`); return value.trim(); }

/** Create a stable VerificationPolicy plus revision 1 and its ResearchEvent. */
export async function createVerificationPolicyCommand({ repository, actorId, actorRole, policyId, requirements, outcomes, eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new VerificationPolicyCommandError("repository withTransaction is required");
  for (const method of ["insertVerificationPolicy", "insertVerificationPolicyRevision", "appendResearchEvent"]) if (typeof repository[method] !== "function") throw new VerificationPolicyCommandError(`repository ${method} is required`);
  actorId = requiredText(actorId, "actor id"); policyId = requiredText(policyId, "policy id");
  let policy;
  try { policy = createVerificationPolicy({ policyId, revision: 1, requirements, outcomes }); } catch (error) { throw new VerificationPolicyCommandError(error.message); }
  if (typeof eventFactory !== "function") throw new VerificationPolicyCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });
  const stable = { policyId, createdBy: actorId };
  const revision = { policyId, revision: 1, supersedes: null, requirements: policy.requirements, outcomes: policy.outcomes, createdBy: actorId };
  const event = await eventFactory({ eventType: "verification_policy.created", payload: { entity_type: "verification_policy", policy_id: policyId, revision: 1, actor_id: actorId } });
  if (!event || typeof event !== "object") throw new VerificationPolicyCommandError("eventFactory must return an event object");
  return repository.withTransaction(async (transaction) => ({ policy: await transaction.insertVerificationPolicy(stable) ?? stable, revision: await transaction.insertVerificationPolicyRevision(revision) ?? revision, event: await transaction.appendResearchEvent(event) ?? event }));
}
