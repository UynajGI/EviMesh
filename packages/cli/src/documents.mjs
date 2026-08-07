import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { schemaFileForDocument, validateAgainstSchema } from "../../schemas/src/validator.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const schemaDir = join(packageRoot, "..", "schemas");

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

export function claimDocToApi(document) {
  return {
    claimId: document.claim_id,
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
    findings: (document.findings ?? []).map((finding, index) => ({ findingId: finding.findingId ?? `finding_${index + 1}`, ...finding })),
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
    signature: "TODO: run signature",
  };
}
