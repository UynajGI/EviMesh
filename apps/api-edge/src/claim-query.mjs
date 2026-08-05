import { paginate } from "./pagination.mjs";

export class ClaimQueryError extends Error {
  constructor(message, code = "CLAIM_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "ClaimQueryError";
    this.code = code;
    this.status = status;
  }
}

function optionalFilter(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) throw new ClaimQueryError(`${field} must be a non-empty string or null`);
  return value.trim();
}

/** List Claim identity rows with stable, opaque cursor pagination. */
export async function listClaims({ repository, projectId = null, status = null, tag = null, limit = 20, cursor = null } = {}) {
  if (!repository || typeof repository.listClaims !== "function") throw new ClaimQueryError("repository listClaims is required");
  const filters = {
    projectId: optionalFilter(projectId, "project id"),
    status: optionalFilter(status, "claim status"),
    tag: optionalFilter(tag, "claim tag"),
  };
  const claims = await repository.listClaims(filters);
  return paginate(claims, { limit, cursor, getKey: (claim) => ({ createdAt: claim.createdAt, id: claim.claimId }) });
}
