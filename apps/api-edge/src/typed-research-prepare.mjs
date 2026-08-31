import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";
import { assertResearchEdge, EVALUATION_STANCES, normalizeNodeRevisionRef, normalizeResearchRevisionLineage, RESEARCH_DOCUMENT_STATES, TOOL_KINDS } from "../../../packages/protocol/src/research-graph.mjs";

const CONFIG = Object.freeze({
  answer: Object.freeze({ idField: "answerId", schema: "srp.answer.v1", eventType: "answer.created" }),
  rebuttal: Object.freeze({ idField: "rebuttalId", schema: "srp.rebuttal.v1", eventType: "rebuttal.created" }),
  evaluation: Object.freeze({ idField: "evaluationId", schema: "srp.evaluation.v1", eventType: "evaluation.created" }),
  dataset: Object.freeze({ idField: "datasetId", schema: "srp.dataset.v1", eventType: "dataset.created" }),
  tool: Object.freeze({ idField: "toolId", schema: "srp.tool.v1", eventType: "tool.created" }),
});

export class TypedResearchPrepareError extends Error {
  constructor(message, code = "TYPED_RESEARCH_PREPARE_INVALID", status = 400) {
    super(message);
    this.name = "TypedResearchPrepareError";
    this.code = code;
    this.status = status;
  }
}

function typeConfig(kind) {
  const value = CONFIG[kind];
  if (!value) throw new TypedResearchPrepareError(`unsupported typed research node: ${String(kind)}`, "RESEARCH_NODE_KIND_INVALID");
  return value;
}

function text(value, field, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) throw new TypedResearchPrepareError(`${field} must be a non-empty string without surrounding whitespace`);
  return value;
}

function stringArray(value, field) {
  if (!Array.isArray(value)) throw new TypedResearchPrepareError(`${field} must be an array`);
  const normalized = value.map((entry, index) => text(entry, `${field}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new TypedResearchPrepareError(`${field} must not contain duplicates`);
  return normalized;
}

function refs(value, field) {
  if (!Array.isArray(value)) throw new TypedResearchPrepareError(`${field} must be an array`);
  return value.map((entry, index) => {
    try {
      return normalizeNodeRevisionRef(entry, `${field}[${index}]`);
    } catch (error) {
      throw new TypedResearchPrepareError(`${field}[${index}] is invalid: ${error.message}`);
    }
  });
}

function oneRef(value, field) {
  const result = refs([value], field);
  return result[0];
}

function edge(type, source, target) {
  try {
    return assertResearchEdge({ type, source, target });
  } catch (error) {
    throw new TypedResearchPrepareError(error.message);
  }
}

function oneOf(value, allowed, field) {
  value = text(value, field);
  if (!allowed.includes(value)) throw new TypedResearchPrepareError(`${field} must be one of: ${allowed.join(", ")}`);
  return value;
}

function nonce(value) {
  value = text(value, "nonce");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new TypedResearchPrepareError("nonce must be 16-128 base64url characters");
  return value;
}

function revisionLineage(revisionValue, supersedesValue) {
  try {
    return normalizeResearchRevisionLineage({ revision: revisionValue ?? 1, supersedesRevision: supersedesValue ?? null });
  } catch (error) {
    throw new TypedResearchPrepareError(error.message);
  }
}

/** Canonicalize a typed submission and derive every immutable incoming edge. */
export function canonicalTypedResearchSubmission({ kind, input, publisherActorId } = {}) {
  const definition = typeConfig(kind);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypedResearchPrepareError("submission must be an object");
  publisherActorId = text(publisherActorId, "publisher actor id");
  const id = text(input[definition.idField], `${kind} id`);
  const { revision, supersedesRevision } = revisionLineage(input.revision, input.supersedesRevision);
  const common = {
    [definition.idField]: id,
    projectId: text(input.projectId, "project id"),
    revision,
    supersedesRevision,
    state: oneOf(input.state ?? "draft", RESEARCH_DOCUMENT_STATES, "state"),
  };
  const target = Object.freeze({ kind, id, revision });
  let node;
  let incomingEdges;
  if (kind === "answer") {
    const questionRef = oneRef(input.questionRef, "questionRef");
    const additionalInputs = refs(input.additionalInputs ?? [], "additionalInputs");
    node = { ...common, title: text(input.title, "title"), synthesis: text(input.synthesis, "synthesis"), limitations: stringArray(input.limitations ?? [], "limitations"), questionRef, additionalInputs };
    incomingEdges = [edge("answers", questionRef, target), ...additionalInputs.map((source) => edge("derived_from", source, target))];
  } else if (kind === "rebuttal") {
    const targetRef = oneRef(input.targetRef, "targetRef");
    const basisRefs = refs(input.basisRefs ?? [], "basisRefs");
    node = { ...common, title: text(input.title, "title"), argument: text(input.argument, "argument"), scope: stringArray(input.scope ?? [], "scope"), targetRef, basisRefs };
    incomingEdges = [edge("rebuts", targetRef, target), ...basisRefs.map((source) => edge("grounds_rebuttal", source, target))];
  } else if (kind === "evaluation") {
    const subjectRef = oneRef(input.subjectRef, "subjectRef");
    const basisRefs = refs(input.basisRefs, "basisRefs");
    if (basisRefs.length === 0) throw new TypedResearchPrepareError("basisRefs must contain at least one immutable reference");
    node = { ...common, subjectRef, basisRefs, stance: oneOf(input.stance, EVALUATION_STANCES, "stance"), rationale: text(input.rationale, "rationale"), method: input.method === null || input.method === undefined ? null : text(input.method, "method") };
    incomingEdges = [edge("evaluates", subjectRef, target), ...basisRefs.map((source) => edge("evaluation_basis", source, target))];
  } else if (kind === "dataset") {
    const artifactRef = oneRef(input.artifactRef, "artifactRef");
    node = { ...common, name: text(input.name, "name"), description: text(input.description, "description"), version: text(input.version, "version"), license: text(input.license, "license"), schemaUri: input.schemaUri === null || input.schemaUri === undefined ? null : text(input.schemaUri, "schemaUri"), provenance: text(input.provenance, "provenance"), artifactRef };
    incomingEdges = [edge("materializes_dataset", artifactRef, target)];
  } else {
    const artifactRef = input.artifactRef === null || input.artifactRef === undefined ? null : oneRef(input.artifactRef, "artifactRef");
    node = { ...common, name: text(input.name, "name"), description: text(input.description, "description"), toolKind: oneOf(input.toolKind, TOOL_KINDS, "toolKind"), version: text(input.version, "version"), runtime: text(input.runtime, "runtime"), inputSchemaUri: input.inputSchemaUri === null || input.inputSchemaUri === undefined ? null : text(input.inputSchemaUri, "inputSchemaUri"), outputSchemaUri: input.outputSchemaUri === null || input.outputSchemaUri === undefined ? null : text(input.outputSchemaUri, "outputSchemaUri"), license: text(input.license, "license"), provenance: text(input.provenance, "provenance"), artifactRef };
    incomingEdges = artifactRef ? [edge("packages_tool", artifactRef, target)] : [];
  }
  if (supersedesRevision !== null) incomingEdges = [edge("supersedes", { kind, id, revision: supersedesRevision }, target), ...incomingEdges];
  const draftedByActorId = input.draftedByActorId === undefined ? publisherActorId : text(input.draftedByActorId, "drafting actor id");
  const eventType = `${kind}.${revision === 1 ? "created" : "revised"}`;
  const payload = Object.freeze({
    schema: definition.schema,
    entityType: kind,
    graphVersion: "research-graph.v1",
    publisherActorId,
    draftedByActorId,
    node: Object.freeze(node),
    incomingEdges: Object.freeze(incomingEdges),
  });
  return Object.freeze({ definition: Object.freeze({ ...definition, eventType }), payload, command: Object.freeze({ ...node }) });
}

export function prepareTypedResearchSubmission({ kind, input, publisherActorId, nonce: requestNonce } = {}) {
  const canonical = canonicalTypedResearchSubmission({ kind, input, publisherActorId });
  requestNonce = nonce(requestNonce);
  const signingBytes = canonicalJson({ event_type: canonical.definition.eventType, payload: canonical.payload, nonce: requestNonce });
  return Object.freeze({
    eventType: canonical.definition.eventType,
    payload: canonical.payload,
    nonce: requestNonce,
    signingBytes,
    signingBytesHash: `sha256:${rawHash(signingBytes)}`,
  });
}

export const TYPED_RESEARCH_SUBMISSION_CONFIG = CONFIG;
