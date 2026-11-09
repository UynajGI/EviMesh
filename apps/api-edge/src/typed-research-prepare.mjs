import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";
import { assertResearchEdge, EVALUATION_STANCES, normalizeNodeRevisionRef, normalizeResearchRevisionLineage, RESEARCH_DOCUMENT_STATES, TOOL_KINDS } from "../../../packages/protocol/src/research-graph.mjs";
import { createTypedResearchCanonicalPayload } from "../../../packages/protocol/src/typed-research-canonical.mjs";

const CONFIG = Object.freeze({
  question: Object.freeze({ idField: "questionId", schema: "srp.question.v1", eventType: "question.created" }),
  claim: Object.freeze({ idField: "claimId", schema: "srp.claim.v1", eventType: "claim.created" }),
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

/*
 * Question and Claim v1 documents. Field order and edge order must match
 * private.derive_typed_research_incoming_edges_v2 (migration 0090) exactly:
 * the database recomputes the motif and rejects any difference.
 */
const QUESTION_STATES = Object.freeze(["proposed", "active"]);
const CLAIM_RELATIONS = Object.freeze({
  derived_from: ["claim"],
  extends: ["claim"],
  implements: ["claim"],
  uses_dataset: ["dataset", "claim"],
  uses_tool: ["tool", "claim"],
});

function optionalText(value, field) {
  return value === null || value === undefined || value === "" ? null : text(value, field);
}

function boundedText(value, field, max) {
  value = text(value, field);
  if (value.length > max) throw new TypedResearchPrepareError(`${field} must be at most ${max} characters`);
  return value;
}

function nonEmptyStringArray(value, field) {
  const normalized = stringArray(value, field);
  if (normalized.length === 0) throw new TypedResearchPrepareError(`${field} must contain at least one entry`);
  return normalized;
}

/* The Research Contract keeps the protocol's question.schema.json field
 * names. Optional fields are omitted rather than nulled so the signed bytes
 * stay minimal and stable. */
function researchContract(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypedResearchPrepareError("researchContract must be an object");
  const contract = {
    problem: boundedText(value.problem, "researchContract.problem", 20000),
    scope: nonEmptyStringArray(value.scope, "researchContract.scope"),
    falsification: nonEmptyStringArray(value.falsification, "researchContract.falsification"),
  };
  if (value.background !== undefined && value.background !== null) contract.background = boundedText(value.background, "researchContract.background", 20000);
  for (const field of ["exclusions", "progress_criteria", "acceptable_evidence"]) {
    if (value[field] !== undefined && value[field] !== null) contract[field] = stringArray(value[field], `researchContract.${field}`);
  }
  if (value.definitions !== undefined && value.definitions !== null) {
    if (typeof value.definitions !== "object" || Array.isArray(value.definitions)) throw new TypedResearchPrepareError("researchContract.definitions must be an object of term: definition");
    contract.definitions = Object.fromEntries(Object.entries(value.definitions).map(([term, definition]) => [text(term, "definition term"), text(definition, `definitions.${term}`)]));
  }
  if (value.license !== undefined && value.license !== null) contract.license = text(value.license, "researchContract.license");
  return contract;
}

function reasoningNode({ kind, id, projectId, revision, supersedesRevision, input, target }) {
  if (id.length > 200) throw new TypedResearchPrepareError(`${kind} id must be at most 200 characters`);
  if (kind === "question") {
    const topics = stringArray(input.topics ?? [], "topics");
    if (topics.length > 8) throw new TypedResearchPrepareError("topics must contain at most 8 entries");
    const extendsRefs = refs(input.extendsRefs ?? [], "extendsRefs");
    for (const [index, ref] of extendsRefs.entries()) {
      if (ref.kind !== "question") throw new TypedResearchPrepareError(`extendsRefs[${index}] must reference a question`);
    }
    const node = {
      questionId: id,
      projectId,
      revision,
      supersedesRevision,
      state: oneOf(input.state ?? "active", QUESTION_STATES, "state"),
      title: boundedText(input.title, "title", 300),
      statement: boundedText(input.statement, "statement", 20000),
      topics,
      researchContract: researchContract(input.researchContract),
      extendsRefs,
    };
    return { node, incomingEdges: extendsRefs.map((source) => edge("extends_question", source, target)) };
  }
  if ((input.state ?? "hypothesis") !== "hypothesis") {
    throw new TypedResearchPrepareError("a new claim revision starts as hypothesis; lifecycle changes come from verification and challenges");
  }
  const answerRef = input.answerRef === null || input.answerRef === undefined ? null : oneRef(input.answerRef, "answerRef");
  if (answerRef && answerRef.kind !== "answer") throw new TypedResearchPrepareError("answerRef must reference an answer");
  if (!Array.isArray(input.relations ?? [])) throw new TypedResearchPrepareError("relations must be an array");
  const relations = (input.relations ?? []).map((relation, index) => {
    if (!relation || typeof relation !== "object" || Array.isArray(relation)) throw new TypedResearchPrepareError(`relations[${index}] must be {type, source}`);
    const allowed = CLAIM_RELATIONS[relation.type];
    if (!allowed) throw new TypedResearchPrepareError(`relations[${index}].type must be one of: ${Object.keys(CLAIM_RELATIONS).join(", ")}`);
    const source = oneRef(relation.source, `relations[${index}].source`);
    if (!allowed.includes(source.kind)) throw new TypedResearchPrepareError(`relations[${index}].source must reference ${allowed.join(" or ")}`);
    return { type: relation.type, source };
  });
  const node = {
    claimId: id,
    projectId,
    revision,
    supersedesRevision,
    state: "hypothesis",
    questionId: optionalText(input.questionId, "questionId"),
    statement: boundedText(input.statement, "statement", 20000),
    scope: nonEmptyStringArray(input.scope, "scope"),
    assumptions: stringArray(input.assumptions ?? [], "assumptions"),
    falsification: nonEmptyStringArray(typeof input.falsification === "string" ? [input.falsification] : input.falsification, "falsification"),
    answerRef,
    relations,
  };
  const incomingEdges = [
    ...(answerRef ? [edge("yields_claim", answerRef, target)] : []),
    ...relations.map((relation) => edge(relation.type, relation.source, target)),
  ];
  return { node, incomingEdges };
}

/** Canonicalize a typed submission and derive every immutable incoming edge. */
export function canonicalTypedResearchSubmission({ kind, input, producerActorId, publisherActorId } = {}) {
  const definition = typeConfig(kind);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypedResearchPrepareError("submission must be an object");
  publisherActorId = text(publisherActorId, "publisher actor id");
  const id = text(input[definition.idField], `${kind} id`);
  const { revision, supersedesRevision } = revisionLineage(input.revision, input.supersedesRevision);
  const projectId = text(input.projectId, "project id");
  const target = Object.freeze({ kind, id, revision });
  let node;
  let incomingEdges;
  if (kind === "question" || kind === "claim") {
    ({ node, incomingEdges } = reasoningNode({ kind, id, projectId, revision, supersedesRevision, input, target }));
  } else {
  const common = {
    [definition.idField]: id,
    projectId,
    revision,
    supersedesRevision,
    state: oneOf(input.state ?? "draft", RESEARCH_DOCUMENT_STATES, "state"),
  };
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
  }
  if (supersedesRevision !== null) incomingEdges = [edge("supersedes", { kind, id, revision: supersedesRevision }, target), ...incomingEdges];
  // Compatibility: callers predating producerActorId already put the Agent in
  // draftedByActorId. Public routes must pass producerActorId explicitly.
  producerActorId = producerActorId === undefined
    ? input.producerActorId === undefined
      ? input.draftedByActorId === undefined
        ? publisherActorId
        : text(input.draftedByActorId, "producer actor id")
      : text(input.producerActorId, "producer actor id")
    : text(producerActorId, "producer actor id");
  const draftedByActorId = input.draftedByActorId === undefined ? producerActorId : text(input.draftedByActorId, "drafting actor id");
  const eventType = `${kind}.${revision === 1 ? "created" : "revised"}`;
  let payload;
  try {
    payload = createTypedResearchCanonicalPayload({
      schema: definition.schema,
      entityType: kind,
      producerActorId,
      draftedByActorId,
      publisherActorId,
      signerActorId: publisherActorId,
      node,
      incomingEdges,
    });
  } catch (error) {
    throw new TypedResearchPrepareError(error.message);
  }
  return Object.freeze({ definition: Object.freeze({ ...definition, eventType }), payload, command: Object.freeze({ ...node }) });
}

export function prepareTypedResearchSubmission({ kind, input, producerActorId, publisherActorId, nonce: requestNonce } = {}) {
  const canonical = canonicalTypedResearchSubmission({ kind, input, producerActorId, publisherActorId });
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
