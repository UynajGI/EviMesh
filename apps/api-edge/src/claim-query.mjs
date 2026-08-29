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

function normalizeGraph(value) {
  if (Array.isArray(value)) return { nodes: value, edges: [], truncated: false };
  return {
    nodes: Array.isArray(value?.nodes) ? value.nodes : [],
    edges: Array.isArray(value?.edges) ? value.edges : [],
    truncated: Boolean(value?.truncated),
  };
}

async function claimOriginatorContributions(repository, claimId) {
  const methods = ["listContributionEdgesForObject", "listContributionStatementsByIds", "listResearchEventsByIds"];
  if (methods.some((method) => typeof repository[method] !== "function")) return [];
  const edges = await repository.listContributionEdgesForObject({ objectType: "claim", objectId: claimId });
  const produced = (Array.isArray(edges) ? edges : []).filter((edge) => edge?.edgeType === "produced");
  const statementIds = [...new Set(produced.map((edge) => edge?.statementId).filter(Boolean))];
  const statements = statementIds.length > 0 ? await repository.listContributionStatementsByIds(statementIds) : [];
  const statementById = new Map((Array.isArray(statements) ? statements : []).map((statement) => [statement?.statementId, statement]));
  const eventIds = [...new Set((Array.isArray(statements) ? statements : []).map((statement) => statement?.eventId).filter(Boolean))];
  const events = eventIds.length > 0 ? await repository.listResearchEventsByIds(eventIds) : [];
  const eventById = new Map((Array.isArray(events) ? events : []).map((event) => [event?.eventId, event]));
  return produced.map((edge) => {
    const statement = statementById.get(edge.statementId);
    const event = eventById.get(statement?.eventId);
    const payload = event?.payload ?? {};
    const actorId = statement?.actorId;
    const draftedByActorId = payload.drafted_by_actor_id ?? payload.draftedByActorId ?? null;
    const signedBy = payload.signer_actor_id ?? payload.signerActorId ?? null;
    if (statement?.role !== "originator" || event?.eventType !== "claim.created" || payload.claim_id !== claimId || draftedByActorId !== actorId) return null;
    return {
      actorId,
      role: statement.role,
      description: statement.description ?? null,
      objectRevision: edge.objectRevision,
      eventId: event.eventId,
      draftedByActorId,
      signedBy,
    };
  }).filter(Boolean);
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
  const [currentRevision, originatorContributions] = await Promise.all([
    repository.getCurrentClaimRevision(claimId),
    claimOriginatorContributions(repository, claimId),
  ]);
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
    originatorContributions,
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
  const graph = normalizeGraph(await repository.getClaimUpstreamGraph({ claimId, maxDepth }));
  return { rootClaimId: claimId, maxDepth, ...graph };
}

/** Return the bounded downstream dependency graph with taint markers. */
export async function getClaimDownstreamGraph({ repository, claimId, maxDepth = 3 } = {}) {
  if (typeof claimId !== "string" || claimId.trim().length === 0) throw new ClaimQueryError("claim id must be a non-empty string");
  claimId = claimId.trim();
  maxDepth = graphDepth(maxDepth);
  if (!repository || typeof repository.getClaimDownstreamGraph !== "function") throw new ClaimQueryError("repository getClaimDownstreamGraph is required");
  const graph = normalizeGraph(await repository.getClaimDownstreamGraph({ claimId, maxDepth }));
  return {
    rootClaimId: claimId,
    maxDepth,
    nodes: graph.nodes.map((node) => ({
      ...node,
      dependencyTainted: Boolean(node.dependencyTainted ?? node.state === "dependency_tainted"),
    })),
    edges: graph.edges,
    truncated: graph.truncated,
  };
}
