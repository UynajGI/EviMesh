import { assertProjectRoleForAction } from "./project-authorization.mjs";
import { assertContextMode } from "../../protocol/src/context-mode.mjs";

export class VerificationContractCommandError extends Error {
  constructor(message, code = "VERIFICATION_CONTRACT_INVALID", status = 400) {
    super(message);
    this.name = "VerificationContractCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new VerificationContractCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) throw new VerificationContractCommandError(`${field} must be a non-empty object`);
  return value;
}

function requiredUniqueStrings(value, field) {
  if (!Array.isArray(value) || value.length === 0) throw new VerificationContractCommandError(`${field} must be a non-empty array`);
  const values = value.map((entry, index) => requiredText(entry, `${field} ${index}`));
  if (new Set(values).size !== values.length) throw new VerificationContractCommandError(`${field} must not contain duplicates`);
  return values;
}

/** Create a stable VerificationContract plus its first immutable revision and ResearchEvent. */
export async function createVerificationContract({ repository, actorId, actorRole, contractId, requirements, verificationTypes, contextModes, eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new VerificationContractCommandError("repository withTransaction is required");
  for (const method of ["insertVerificationContract", "insertVerificationContractRevision", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") throw new VerificationContractCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, "actor id");
  contractId = requiredText(contractId, "contract id");
  requirements = requiredObject(requirements, "requirements");
  verificationTypes = requiredUniqueStrings(verificationTypes, "verification types");
  contextModes = requiredUniqueStrings(contextModes, "context modes");
  try { contextModes.forEach(assertContextMode); } catch { throw new VerificationContractCommandError("context modes contain an unsupported mode"); }
  if (typeof eventFactory !== "function") throw new VerificationContractCommandError("eventFactory is required");
  assertProjectRoleForAction({ actorRole, requiredRole: "maintainer" });
  const contract = { contractId, createdBy: actorId };
  const revision = { contractId, revision: 1, supersedes: null, requirements, verificationTypes, contextModes, createdBy: actorId };
  const event = await eventFactory({ eventType: "verification_contract.created", payload: { entity_type: "verification_contract", contract_id: contractId, revision: 1, actor_id: actorId } });
  if (!event || typeof event !== "object") throw new VerificationContractCommandError("eventFactory must return an event object");
  return repository.withTransaction(async (transaction) => ({
    contract: await transaction.insertVerificationContract(contract) ?? contract,
    revision: await transaction.insertVerificationContractRevision(revision) ?? revision,
    event: await transaction.appendResearchEvent(event) ?? event,
  }));
}
