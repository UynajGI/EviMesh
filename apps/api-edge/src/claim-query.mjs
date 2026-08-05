import { paginate } from "./pagination.mjs";
import { claimTransitionsFrom } from "../../../packages/protocol/src/claim-state.mjs";

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

function graphDepth(value) {
  if (!Number.isInteger(value) || value < 1 || value > 32) throw new ClaimQueryError("graph depth must be an integer between 1 and 32");
  return value;
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

/** Return a Claim with its immutable current revision and protocol status policy. */
export async function getClaim({ repository, claimId } = {}) {
  if (typeof claimId !== "string" || claimId.trim().length === 0) throw new ClaimQueryError("claim id must be a non-empty string");
  claimId = claimId.trim();
  if (!repository || typeof repository.getClaim !== "function" || typeof repository.getCurrentClaimRevision !== "function") {
    throw new ClaimQueryError("repository claim detail methods are required");
  }
  const claim = await repository.getClaim(claimId);
  if (!claim) throw new ClaimQueryError("claim not found", "CLAIM_NOT_FOUND", 404);
  const currentRevision = await repository.getCurrentClaimRevision(claimId);
  if (!currentRevision) throw new ClaimQueryError("current claim revision not found", "CLAIM_REVISION_NOT_FOUND", 500);
  let allowedTransitions;
  try {
    allowedTransitions = claimTransitionsFrom(claim.state);
  } catch (error) {
    throw new ClaimQueryError(error.message, "CLAIM_STATE_INVALID", 500);
  }
  return {
    claim,
    currentRevision,
    statusPolicy: { state: claim.state, allowedTransitions: [...allowedTransitions] },
  };
}

/** Return one immutable Claim revision by its stable revision number. */
export async function getClaimRevision({ repository, claimId, revision } = {}) {
  if (typeof claimId !== "string" || claimId.trim().length === 0) throw new ClaimQueryError("claim id must be a non-empty string");
  claimId = claimId.trim();
  if (!Number.isInteger(revision) || revision < 1) throw new ClaimQueryError("claim revision must be a positive integer");
  if (!repository || typeof repository.getClaimRevision !== "function") throw new ClaimQueryError("repository getClaimRevision is required");
  const claimRevision = await repository.getClaimRevision(claimId, revision);
  if (!claimRevision) throw new ClaimQueryError("claim revision not found", "CLAIM_REVISION_NOT_FOUND", 404);
  return claimRevision;
}

/** Return the bounded upstream dependency graph for a Claim. */
export async function getClaimUpstreamGraph({ repository, claimId, maxDepth = 3 } = {}) {
  if (typeof claimId !== "string" || claimId.trim().length === 0) throw new ClaimQueryError("claim id must be a non-empty string");
  claimId = claimId.trim();
  maxDepth = graphDepth(maxDepth);
  if (!repository || typeof repository.getClaimUpstreamGraph !== "function") throw new ClaimQueryError("repository getClaimUpstreamGraph is required");
  const nodes = await repository.getClaimUpstreamGraph({ claimId, maxDepth });
  return { rootClaimId: claimId, maxDepth, nodes: Array.isArray(nodes) ? nodes : [] };
}
