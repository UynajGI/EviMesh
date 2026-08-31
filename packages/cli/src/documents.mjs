import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { schemaFileForDocument, validateAgainstSchema } from "../../schemas/src/validator.mjs";
import { canonicalJson } from "../../protocol/src/hash.mjs";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const packagedSchemaDir = join(moduleDir, "schemas");
const sourceSchemaDir = join(moduleDir, "..", "..", "schemas");

// Source execution reads the repository schemas package. The published bundle
// copies these assets beside its executable, keeping document validation fully
// self-contained after `npm install`.
export const schemaDir = existsSync(packagedSchemaDir) ? packagedSchemaDir : sourceSchemaDir;

export class CliDocumentError extends Error {
  constructor(message, code = "CLI_DOCUMENT_INVALID", findings = []) {
    super(message);
    this.name = "CliDocumentError";
    this.code = code;
    this.findings = findings;
  }
}

export function readDocument(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new CliDocumentError(`cannot read document: ${path}`, "CLI_DOCUMENT_UNREADABLE");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new CliDocumentError(`document is not valid JSON: ${path}`, "CLI_DOCUMENT_JSON");
  }
}

/** Validate one protocol document against the schema selected by its discriminator. */
export function validateDocument(document) {
  const file = schemaFileForDocument(document);
  if (!file) {
    throw new CliDocumentError(`unknown document schema discriminator: ${JSON.stringify(document?.schema ?? null)}`, "CLI_DOCUMENT_SCHEMA_UNKNOWN");
  }
  const schema = JSON.parse(readFileSync(join(schemaDir, file), "utf8"));
  const result = validateAgainstSchema(schema, document);
  if (!result.valid) {
    throw new CliDocumentError(`document failed ${file} validation`, "CLI_DOCUMENT_VALIDATION", [...result.findings]);
  }
  return { schemaFile: file, result };
}

function parseRevisionRef(value, label) {
  if (typeof value !== "string" || !value.includes("@")) {
    throw new CliDocumentError(`${label} must be formatted as objectId@revision`, "CLI_DOCUMENT_REF");
  }
  const [id, revision] = value.split("@");
  const parsed = Number(revision);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CliDocumentError(`${label} revision must be a positive integer`, "CLI_DOCUMENT_REF");
  }
  return { id, revision: parsed };
}

function artifactRefs(ids, label) {
  return (ids ?? []).map((entry) => {
    if (typeof entry === "string" && entry.includes("@")) {
      const [artifactId, revision] = entry.split("@");
      return { artifactId, artifactRevision: Number(revision) };
    }
    return { artifactId: String(entry), artifactRevision: 1 };
  });
}

function canonicalRunArtifactRefs(document) {
  const canonicalRef = (value) => {
    if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
      throw new CliDocumentError("Run artifact refs must be non-empty strings", "RUN_ARTIFACT_REF_INVALID");
    }
    const separator = value.indexOf("@");
    if (separator !== value.lastIndexOf("@")) {
      throw new CliDocumentError("Run artifact refs must contain at most one @", "RUN_ARTIFACT_REF_INVALID");
    }
    if (separator === -1) return `${value}@1`;
    const artifactId = value.slice(0, separator);
    const revisionText = value.slice(separator + 1);
    if (!artifactId || artifactId.trim() !== artifactId || !/^[0-9]+$/.test(revisionText)) {
      throw new CliDocumentError("Run artifact refs must be formatted as artifactId@positiveRevision", "RUN_ARTIFACT_REF_INVALID");
    }
    const revision = Number(revisionText);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      throw new CliDocumentError("Run artifact revisions must be positive safe integers", "RUN_ARTIFACT_REF_INVALID");
    }
    return `${artifactId}@${revision}`;
  };
  const normalizeAndSort = (refs, field) => {
    if (!Array.isArray(refs)) throw new CliDocumentError(`${field} must be an array`, "RUN_ARTIFACT_REFS_INVALID");
    const canonicalRefs = [...refs].map(canonicalRef);
    if (new Set(canonicalRefs).size !== canonicalRefs.length) {
      throw new CliDocumentError(`${field} must not repeat an artifact revision`, "RUN_ARTIFACT_REFS_DUPLICATE");
    }
    return canonicalRefs.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  };
  return {
    ...document,
    input_artifact_ids: normalizeAndSort(document.input_artifact_ids, "input_artifact_ids"),
    output_artifact_ids: normalizeAndSort(document.output_artifact_ids, "output_artifact_ids"),
  };
}

const RUN_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|[+-](\d{2}):(\d{2}))$/;

function hasValidRunTimestampParts(match) {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[8] ?? 0);
  const offsetMinute = Number(match[9] ?? 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12
    && day >= 1 && day <= daysInMonth[month - 1]
    && hour <= 23 && minute <= 59 && second <= 59
    && offsetHour <= 23 && offsetMinute <= 59;
}

function canonicalRunTimestamp(value) {
  const match = typeof value === "string" && value.trim() === value ? RUN_TIMESTAMP_PATTERN.exec(value) : null;
  if (!match || !hasValidRunTimestampParts(match)) {
    throw new CliDocumentError("Run timestamps must be RFC3339 date-time strings", "RUN_TIMESTAMP_INVALID");
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new CliDocumentError("Run timestamps must be valid date-times", "RUN_TIMESTAMP_INVALID");
  return timestamp.toISOString();
}

function canonicalRunText(value, field) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new CliDocumentError(`${field} must be a non-empty string without leading or trailing whitespace`, "RUN_TEXT_INVALID");
  }
  return value;
}

export function canonicalRunDocument(document) {
  const withCanonicalRefs = canonicalRunArtifactRefs(document);
  return {
    ...withCanonicalRefs,
    run_id: canonicalRunText(withCanonicalRefs.run_id, "run_id"),
    task_id: canonicalRunText(withCanonicalRefs.task_id, "task_id"),
    context_bundle_id: canonicalRunText(withCanonicalRefs.context_bundle_id, "context_bundle_id"),
    source_code: canonicalRunText(withCanonicalRefs.source_code, "source_code"),
    container: canonicalRunText(withCanonicalRefs.container, "container"),
    command: canonicalRunText(withCanonicalRefs.command, "command"),
    actor_id: canonicalRunText(withCanonicalRefs.actor_id, "actor_id"),
    signing_key_id: canonicalRunText(withCanonicalRefs.signing_key_id, "signing_key_id"),
    started_at: canonicalRunTimestamp(withCanonicalRefs.started_at),
    ended_at: canonicalRunTimestamp(withCanonicalRefs.ended_at),
  };
}

export function assertCanonicalRunDocument(document) {
  if (canonicalJson(canonicalRunDocument(document)) !== canonicalJson(document)) {
    throw new CliDocumentError("Run document must already use canonical artifact revisions and UTC timestamps", "RUN_DOCUMENT_NONCANONICAL");
  }
  return document;
}

export function claimDocToApi(document) {
  return {
    claimId: document.claim_id,
    draftedByActorId: document.created_by,
    questionId: document.question_id ?? null,
    statement: document.statement,
    scope: document.scope,
    assumptions: document.assumptions ?? [],
    falsification: document.falsification,
  };
}

export function runDocToApi(document) {
  return {
    runId: document.run_id,
    taskId: document.task_id,
    contextBundleId: document.context_bundle_id,
    sourceCode: document.source_code,
    container: document.container,
    command: document.command,
    args: document.args ?? [],
    environment: document.environment ?? {},
    hardware: document.hardware ?? {},
    randomSeed: document.random_seed ?? {},
    startedAt: document.started_at,
    endedAt: document.ended_at,
    networkAccess: document.network_access ?? false,
    exitCode: document.exit_code,
    actorId: document.actor_id,
    signingKeyId: document.signing_key_id,
    signature: document.signature,
    inputs: artifactRefs(document.input_artifact_ids, "inputs"),
    outputs: artifactRefs(document.output_artifact_ids, "outputs"),
  };
}

export function verificationDocToApi(document, { receiptId, runId, contributionStatementId }) {
  const claim = parseRevisionRef(document.claim_revision_id, "claim_revision_id");
  const contract = parseRevisionRef(document.contract_revision_id, "contract_revision_id");
  return {
    receiptId,
    runId,
    claimId: claim.id,
    claimRevision: claim.revision,
    contractId: contract.id,
    contractRevision: contract.revision,
    outcome: document.outcome,
    verificationTypes: document.verification_types,
    contextMode: document.context_mode,
    sawExpectedOutputs: document.saw_expected_outputs,
    implementationRelation: document.implementation_relation,
    dataRelation: document.data_relation,
    modelFamily: document.model_family,
    findings: (document.findings ?? []).map((finding, index) => ({ findingId: finding.findingId ?? `${receiptId}_finding_${index + 1}`, ...finding })),
    contributionStatementId,
  };
}

export function challengeDocToApi(document) {
  const target = parseRevisionRef(document.target_claim_revision_id, "target_claim_revision_id");
  return {
    challengeId: document.challenge_id,
    targetClaimId: target.id,
    targetClaimRevision: target.revision,
    reason: document.reason,
    impact: document.impact,
    proposedResolution: document.proposed_resolution ?? null,
  };
}

const TYPED_DOCUMENTS = Object.freeze({
  "srp.answer.v1": Object.freeze({ kind: "answer", plural: "answers", idField: "answer_id" }),
  "srp.rebuttal.v1": Object.freeze({ kind: "rebuttal", plural: "rebuttals", idField: "rebuttal_id" }),
  "srp.evaluation.v1": Object.freeze({ kind: "evaluation", plural: "evaluations", idField: "evaluation_id" }),
  "srp.dataset.v1": Object.freeze({ kind: "dataset", plural: "datasets", idField: "dataset_id" }),
  "srp.tool.v1": Object.freeze({ kind: "tool", plural: "tools", idField: "tool_id" }),
});

export function typedDocumentDefinition(document) {
  return TYPED_DOCUMENTS[document?.schema] ?? null;
}

export function typedDocToApi(document) {
  const definition = typedDocumentDefinition(document);
  if (!definition) throw new CliDocumentError(`expected a typed research document, got ${document?.schema ?? "unknown"}`, "CLI_TYPED_DOCUMENT_EXPECTED");
  const common = {
    [`${definition.kind}Id`]: document[definition.idField],
    projectId: document.project_id,
    revision: document.revision,
    supersedesRevision: document.supersedes_revision ?? null,
    state: document.state,
    draftedByActorId: document.created_by,
  };
  switch (definition.kind) {
    case "answer": return { ...common, title: document.title, synthesis: document.synthesis, limitations: document.limitations, questionRef: document.question_ref, additionalInputs: document.additional_inputs };
    case "rebuttal": return { ...common, title: document.title, argument: document.argument, scope: document.scope, targetRef: document.target_ref, basisRefs: document.basis_refs };
    case "evaluation": return { ...common, subjectRef: document.subject_ref, basisRefs: document.basis_refs, stance: document.stance, rationale: document.rationale, method: document.method };
    case "dataset": return { ...common, name: document.name, description: document.description, version: document.version, license: document.license, schemaUri: document.schema_uri, provenance: document.provenance, artifactRef: document.artifact_ref };
    case "tool": return { ...common, name: document.name, description: document.description, toolKind: document.tool_kind, version: document.version, runtime: document.runtime, inputSchemaUri: document.input_schema_uri, outputSchemaUri: document.output_schema_uri, license: document.license, provenance: document.provenance, artifactRef: document.artifact_ref };
    default: throw new CliDocumentError(`unsupported typed research document: ${document.schema}`, "CLI_TYPED_DOCUMENT_EXPECTED");
  }
}

export function typedSubmissionRoute(document) {
  const definition = typedDocumentDefinition(document);
  if (!definition) return null;
  return Object.freeze({ kind: definition.kind, path: `/${definition.plural}`, preparePath: `/${definition.plural}/prepare`, eventType: `${definition.kind}.${document.revision === 1 ? "created" : "revised"}` });
}

function todoRef(kind) {
  return { kind, id: `${kind}_TODO`, revision: 1 };
}

export function typedResearchTemplate({ kind, id, projectId = "project_TODO", createdBy = "TODO: drafting actor id" } = {}) {
  const common = { schema: `srp.${kind}.v1`, [`${kind}_id`]: id, project_id: projectId, revision: 1, supersedes_revision: null, state: "draft", created_at: new Date().toISOString(), created_by: createdBy };
  switch (kind) {
    case "answer": return { ...common, title: "TODO: answer title", synthesis: "TODO: synthesize the answer", limitations: [], question_ref: todoRef("question"), additional_inputs: [] };
    case "rebuttal": return { ...common, title: "TODO: rebuttal title", argument: "TODO: state the counterargument", scope: [], target_ref: todoRef("claim"), basis_refs: [] };
    case "evaluation": return { ...common, subject_ref: todoRef("claim"), basis_refs: [todoRef("evidence")], stance: "supports", rationale: "TODO: explain the evaluation", method: null };
    case "dataset": return { ...common, name: "TODO: dataset name", description: "TODO: describe the dataset", version: "1.0.0", license: "TODO: SPDX license", schema_uri: null, provenance: "TODO: dataset provenance", artifact_ref: todoRef("artifact") };
    case "tool": return { ...common, name: "TODO: tool name", description: "TODO: describe the tool", tool_kind: "skill", version: "1.0.0", runtime: "TODO: pinned runtime", input_schema_uri: null, output_schema_uri: null, license: "TODO: SPDX license", provenance: "TODO: tool provenance", artifact_ref: null };
    default: throw new CliDocumentError(`unsupported typed research kind: ${kind}`, "CLI_TYPED_KIND_INVALID");
  }
}

export function submissionRoute(document) {
  switch (document.schema) {
    case "srp.claim.v1":
      return { eventType: "claim.created", toApi: claimDocToApi, path: "/claims", method: "POST" };
    case "srp.run.v1":
      return { eventType: "run.created", toApi: runDocToApi, path: "/runs", method: "POST" };
    case "srp.challenge.v1":
      return { eventType: "challenge.created", toApi: challengeDocToApi, path: "/challenges", method: "POST" };
    default:
      return null;
  }
}

export function claimTemplate({ claimId, questionId = null }) {
  const template = {
    schema: "srp.claim.v1",
    claim_id: claimId,
    revision: 1,
    state: "hypothesis",
    statement: "TODO: one falsifiable statement",
    scope: ["TODO: the boundary this claim covers"],
    assumptions: [],
    falsification: ["TODO: an observation that would refute this claim"],
    created_at: new Date().toISOString(),
    created_by: "TODO: actor id",
  };
  if (questionId !== null) template.question_id = questionId;
  return template;
}

export function runTemplate({ runId, taskId, contextBundleId }) {
  return {
    schema: "srp.run.v1",
    run_id: runId,
    task_id: taskId,
    context_bundle_id: contextBundleId,
    input_artifact_ids: [],
    source_code: "TODO: code reference (artifact id or VCS commit)",
    container: `TODO-image@sha256:${"0".repeat(64)}`,
    command: "TODO",
    args: [],
    environment: {},
    hardware: {},
    random_seed: {},
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    network_access: false,
    output_artifact_ids: [],
    exit_code: 0,
    actor_id: "TODO: actor id",
    signing_key_id: "TODO: signing key id",
    signature: "TODO: run signature",
  };
}
