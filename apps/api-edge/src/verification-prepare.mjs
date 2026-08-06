import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";

export class VerificationPrepareError extends Error { constructor(message, code = "VERIFICATION_PREPARE_INVALID", status = 400) { super(message); this.name = "VerificationPrepareError"; this.code = code; this.status = status; } }
function text(value, field) { if (typeof value !== "string" || value.trim().length === 0) throw new VerificationPrepareError(`${field} must be a non-empty string`); return value.trim(); }
function positive(value, field) { if (!Number.isInteger(value) || value < 1) throw new VerificationPrepareError(`${field} must be a positive integer`); return value; }
function nonce(value) { value = text(value, "nonce"); if (!/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new VerificationPrepareError("nonce must be 16-128 base64url characters"); return value; }

/** Load exact revisions and return canonical bytes for a client-side signature. */
export async function prepareVerification({ repository, actorId, claimId, claimRevision, contractId, contractRevision, nonce: requestNonce } = {}) {
  if (!repository || typeof repository.getClaimRevision !== "function" || typeof repository.getVerificationContractRevision !== "function") throw new VerificationPrepareError("repository verification prepare methods are required");
  actorId = text(actorId, "actor id"); claimId = text(claimId, "claim id"); claimRevision = positive(claimRevision, "claim revision"); contractId = text(contractId, "contract id"); contractRevision = positive(contractRevision, "contract revision"); requestNonce = nonce(requestNonce);
  const [claim, contract] = await Promise.all([repository.getClaimRevision(claimId, claimRevision), repository.getVerificationContractRevision(contractId, contractRevision)]);
  if (!claim) throw new VerificationPrepareError("claim revision not found", "CLAIM_REVISION_NOT_FOUND", 404);
  if (!contract) throw new VerificationPrepareError("verification contract revision not found", "CONTRACT_REVISION_NOT_FOUND", 404);
  const payload = { entity_type: "verification", actor_id: actorId, claim_id: claimId, claim_revision: claimRevision, contract_id: contractId, contract_revision: contractRevision, verification_types: contract.verificationTypes, context_modes: contract.contextModes };
  const signingBytes = canonicalJson({ event_type: "verification.submitted", payload, nonce: requestNonce });
  return Object.freeze({ eventType: "verification.submitted", payload: Object.freeze(payload), nonce: requestNonce, signingBytes, signingBytesHash: `sha256:${rawHash(signingBytes)}` });
}
