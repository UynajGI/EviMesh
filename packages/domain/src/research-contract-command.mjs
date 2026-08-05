import { assertProjectRoleForAction } from "./project-authorization.mjs";

export class ResearchContractCommandError extends Error {
  constructor(message, code = "RESEARCH_CONTRACT_INVALID", status = 400) {
    super(message);
    this.name = "ResearchContractCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ResearchContractCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredJson(value, field) {
  if (value === undefined || value === null || typeof value !== "object") throw new ResearchContractCommandError(`${field} must be a JSON object or array`);
  return value;
}

/** Append a ResearchContract revision while preserving all historical revisions. */
export async function reviseResearchContract({
  repository,
  actorId,
  actorRole,
  contractId,
  ifMatch,
  currentEtag,
  patch = {},
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new ResearchContractCommandError("repository withTransaction is required");
  for (const method of ["getCurrentResearchContractRevision", "insertResearchContractRevision", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new ResearchContractCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  contractId = requiredText(contractId, "contract id");
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new ResearchContractCommandError("contract patch must be an object");
  if (typeof currentEtag !== "string" || currentEtag.length === 0) throw new ResearchContractCommandError("current ETag is required");
  if (typeof eventFactory !== "function") throw new ResearchContractCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getCurrentResearchContractRevision(contractId);
    if (!current) throw new ResearchContractCommandError("current contract revision not found", "CONTRACT_REVISION_NOT_FOUND", 404);
    if (typeof ifMatch !== "string" || ifMatch.trim() !== currentEtag) throw new ResearchContractCommandError("If-Match does not match the current revision", "PRECONDITION_FAILED", 412);
    const next = {
      contractId,
      revision: current.revision + 1,
      supersedes: current.revision,
      problem: patch.problem === undefined ? current.problem : requiredText(patch.problem, "problem"),
      definitions: patch.definitions === undefined ? current.definitions : requiredJson(patch.definitions, "definitions"),
      background: patch.background === undefined ? current.background : requiredText(patch.background, "background"),
      scope: patch.scope === undefined ? current.scope : requiredJson(patch.scope, "scope"),
      exclusions: patch.exclusions === undefined ? current.exclusions : requiredJson(patch.exclusions, "exclusions"),
      progressCriteria: patch.progressCriteria === undefined ? current.progressCriteria : requiredJson(patch.progressCriteria, "progress criteria"),
      acceptableEvidence: patch.acceptableEvidence === undefined ? current.acceptableEvidence : requiredJson(patch.acceptableEvidence, "acceptable evidence"),
      falsification: patch.falsification === undefined ? current.falsification : requiredJson(patch.falsification, "falsification"),
      license: patch.license === undefined ? current.license : requiredText(patch.license, "license"),
      riskLevel: patch.riskLevel === undefined ? current.riskLevel : requiredText(patch.riskLevel, "risk level"),
      maintainerIds: patch.maintainerIds === undefined ? current.maintainerIds : requiredJson(patch.maintainerIds, "maintainer ids"),
      createdBy: actorId,
    };
    const event = await eventFactory({
      eventType: "research_contract.revised",
      payload: { entity_type: "research_contract", contract_id: contractId, revision: next.revision, actor_id: actorId },
    });
    if (!event || typeof event !== "object") throw new ResearchContractCommandError("eventFactory must return an event object");
    const persistedRevision = await transaction.insertResearchContractRevision(next);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return { revision: persistedRevision ?? next, event: persistedEvent ?? event };
  });
}
