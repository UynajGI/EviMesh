const NODE_LIMIT = 200;
const EDGE_LIMIT = 400;
const DIRECTIONS = new Set(["upstream", "downstream", "both"]);
const NODE_KINDS = new Set([
  "project", "research_contract", "question", "answer", "claim", "rebuttal", "evaluation",
  "dataset", "tool", "artifact", "evidence", "task", "attempt", "context_bundle", "run",
  "verification_contract", "verification_policy", "policy_evaluation", "verification_receipt",
  "verification_finding", "challenge", "merge_proposal", "frontier_snapshot",
]);

export class ResearchGraphQueryError extends Error {
  constructor(message, code = "RESEARCH_GRAPH_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "ResearchGraphQueryError";
    this.code = code;
    this.status = status;
  }
}

function text(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ResearchGraphQueryError(`${field} must be a non-empty string`);
  return value.trim();
}

function positiveRevision(value) {
  if (value === null || value === undefined || value === "") return null;
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 1) throw new ResearchGraphQueryError("revision must be a positive integer");
  return revision;
}

function boundedDepth(value) {
  const depth = value === null || value === undefined || value === "" ? 1 : Number(value);
  if (!Number.isInteger(depth) || depth < 1 || depth > 3) throw new ResearchGraphQueryError("depth must be an integer between 1 and 3");
  return depth;
}

function csv(value, field) {
  if (value === null || value === undefined || value === "") return [];
  const values = String(value).split(",").map((item) => item.trim()).filter(Boolean);
  if (values.length === 0) throw new ResearchGraphQueryError(`${field} must contain at least one value`);
  return [...new Set(values)];
}

function refKey(ref) {
  return `${ref?.kind ?? ""}:${ref?.id ?? ""}@${ref?.revision ?? ""}`;
}

function normalizeRef(value, fallback = null) {
  const ref = value ?? fallback;
  if (!ref || typeof ref !== "object") throw new ResearchGraphQueryError("repository returned an invalid node revision reference", "RESEARCH_GRAPH_RESPONSE_INVALID", 500);
  const kind = text(ref.kind, "node kind").toLowerCase();
  const id = text(ref.id, "node id");
  const revision = positiveRevision(ref.revision);
  if (revision === null) throw new ResearchGraphQueryError("repository node references must include a revision", "RESEARCH_GRAPH_RESPONSE_INVALID", 500);
  return Object.freeze({ kind, id, revision });
}

function normalizeNode(node) {
  const ref = normalizeRef(node?.ref);
  return {
    ...node,
    ref,
    label: typeof node?.label === "string" && node.label ? node.label : ref.id,
    family: typeof node?.family === "string" && node.family ? node.family : "structure",
    state: typeof node?.state === "string" && node.state ? node.state : "unknown",
    canonicalHref: typeof node?.canonicalHref === "string" ? node.canonicalHref : null,
    createdAt: node?.createdAt ?? null,
    createdBy: node?.createdBy ?? null,
    isCurrent: node?.isCurrent !== false,
  };
}

function normalizeEdge(edge) {
  if (!edge || typeof edge !== "object") throw new ResearchGraphQueryError("repository returned an invalid research edge", "RESEARCH_GRAPH_RESPONSE_INVALID", 500);
  const source = normalizeRef(edge.source);
  const target = normalizeRef(edge.target);
  const type = text(edge.type, "edge type");
  return {
    ...edge,
    id: typeof edge.id === "string" && edge.id ? edge.id : `${refKey(source)}:${type}:${refKey(target)}`,
    type,
    family: typeof edge.family === "string" && edge.family ? edge.family : "lineage",
    source,
    target,
    forwardLabel: typeof edge.forwardLabel === "string" && edge.forwardLabel ? edge.forwardLabel : type,
    reverseLabel: typeof edge.reverseLabel === "string" && edge.reverseLabel ? edge.reverseLabel : type,
    provenanceEventId: edge.provenanceEventId ?? null,
  };
}

function boundedNeighborhood(result, { requestedRoot, nodeKinds, edgeTypes, anonymous }) {
  const resolvedRoot = normalizeRef(result?.resolvedRoot, requestedRoot);
  const pinnedRequestedRoot = normalizeRef({ ...requestedRoot, revision: requestedRoot.revision ?? resolvedRoot.revision });
  let nodes = (Array.isArray(result?.nodes) ? result.nodes : []).map(normalizeNode);
  let edges = (Array.isArray(result?.edges) ? result.edges : []).map(normalizeEdge);
  if (nodeKinds.length > 0) nodes = nodes.filter((node) => nodeKinds.includes(node.ref.kind) || refKey(node.ref) === refKey(resolvedRoot));
  if (edgeTypes.length > 0) edges = edges.filter((edge) => edgeTypes.includes(edge.type));
  const locallyTruncated = nodes.length > NODE_LIMIT || edges.length > EDGE_LIMIT;
  nodes = nodes.slice(0, NODE_LIMIT);
  const visibleRefs = new Set(nodes.map((node) => refKey(node.ref)));
  edges = edges.filter((edge) => visibleRefs.has(refKey(edge.source)) && visibleRefs.has(refKey(edge.target))).slice(0, EDGE_LIMIT);
  return Object.freeze({
    schemaVersion: "research-neighborhood.v1",
    requestedRoot: pinnedRequestedRoot,
    resolvedRoot,
    nodes,
    edges,
    truncated: Boolean(result?.truncated) || locallyTruncated,
    permissionPartial: anonymous || result?.permissionPartial !== false,
    nextCursor: typeof result?.nextCursor === "string" ? result.nextCursor : null,
    graphWatermark: result?.graphWatermark ?? null,
  });
}

/**
 * Read one immutable, typed neighborhood. The repository owns visibility
 * filtering and cursor semantics; this boundary owns validation and hard caps.
 */
export async function getResearchNeighborhood({ repository, kind, id, revision = null, direction = "both", depth = 1, nodeKinds = [], edgeTypes = [], cursor = null, accessToken = null, actorId = null } = {}) {
  kind = text(kind, "node kind").toLowerCase();
  if (!NODE_KINDS.has(kind)) throw new ResearchGraphQueryError(`unsupported node kind: ${kind}`, "RESEARCH_NODE_KIND_INVALID");
  id = text(id, "node id");
  revision = positiveRevision(revision);
  direction = text(direction, "direction").toLowerCase();
  if (!DIRECTIONS.has(direction)) throw new ResearchGraphQueryError("direction must be upstream, downstream, or both");
  depth = boundedDepth(depth);
  nodeKinds = Array.isArray(nodeKinds) ? nodeKinds : csv(nodeKinds, "kinds");
  edgeTypes = Array.isArray(edgeTypes) ? edgeTypes : csv(edgeTypes, "edge types");
  nodeKinds = [...new Set(nodeKinds.map((value) => text(value, "node kind").toLowerCase()))];
  for (const nodeKind of nodeKinds) if (!NODE_KINDS.has(nodeKind)) throw new ResearchGraphQueryError(`unsupported node kind filter: ${nodeKind}`, "RESEARCH_NODE_KIND_INVALID");
  edgeTypes = [...new Set(edgeTypes.map((value) => text(value, "edge type")))];
  if (cursor !== null && (typeof cursor !== "string" || cursor.length === 0)) throw new ResearchGraphQueryError("cursor must be a non-empty string or null");
  if (!repository || typeof repository.getResearchNeighborhood !== "function") {
    throw new ResearchGraphQueryError("repository getResearchNeighborhood is required", "RESEARCH_GRAPH_UNAVAILABLE", 503);
  }
  const requestedRoot = Object.freeze({ kind, id, ...(revision === null ? {} : { revision }) });
  const result = await repository.getResearchNeighborhood({
    root: requestedRoot,
    direction,
    depth,
    nodeKinds,
    edgeTypes,
    cursor,
    accessToken,
    actorId,
    nodeLimit: NODE_LIMIT,
    edgeLimit: EDGE_LIMIT,
  });
  if (!result) throw new ResearchGraphQueryError("research node not found", "RESEARCH_NODE_NOT_FOUND", 404);
  return boundedNeighborhood(result, { requestedRoot, nodeKinds, edgeTypes, anonymous: accessToken === null });
}

export function parseResearchGraphFilters({ kinds = null, edgeTypes = null } = {}) {
  return { nodeKinds: csv(kinds, "kinds"), edgeTypes: csv(edgeTypes, "edge types") };
}

export const RESEARCH_GRAPH_LIMITS = Object.freeze({ nodes: NODE_LIMIT, edges: EDGE_LIMIT, maxDepth: 3 });
