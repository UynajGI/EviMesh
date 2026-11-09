import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildClient } from "./client.mjs";
import { flagBool, flagString, requirePositional } from "./args.mjs";
import { readDocument, typedDocToApi, typedDocumentDefinition, typedResearchTemplate, typedSubmissionRoute, validateDocument } from "./documents.mjs";
import { exportLocalPublicKey, localKeySecurityWarnings, unlockLocalIdentity } from "./identity.mjs";
import { rejectSigningBypassFlags, requireHumanInteraction } from "./human-interaction.mjs";
import { createNonce, signSubmission, validatePreparedSigningMaterial } from "./signing.mjs";
import { canonicalJson } from "../../protocol/src/hash.mjs";
import { assertResearchEdge } from "../../protocol/src/research-graph.mjs";
import { createTypedResearchCanonicalPayload } from "../../protocol/src/typed-research-canonical.mjs";
import { createObjectId } from "../../protocol/src/uuidv7.mjs";
import { requirePublicCapability } from "./capabilities.mjs";

const OBJECT_KIND = Object.freeze({ question: "question", claim: "claim", answer: "Answer", rebuttal: "Rebuttal", evaluation: "Evaluation", dataset: "Dataset", tool: "Tool" });

/* Question/Claim use the signed /research/* paths; other kinds use their own collection. */
function preparer(client, route) {
  return route.signed ? client[`${route.kind}s`].prepareSigned : client[`${route.kind}s`].prepare;
}

function submitter(client, route) {
  return route.signed ? client[`${route.kind}s`].submitSigned : client[`${route.kind}s`].submit;
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function writeJson(path, value) {
  ensureParent(path);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function defaultDerivedPath(inputPath, suffix) {
  return resolve(`${String(inputPath).replace(/\.json$/i, "")}.${suffix}.json`);
}

function expectedIncomingEdges(kind, node) {
  const idField = `${kind}Id`;
  const target = { kind, id: node[idField], revision: node.revision };
  const edges = [];
  if (node.supersedesRevision !== null) {
    edges.push(assertResearchEdge({
      type: "supersedes",
      source: { kind, id: node[idField], revision: node.supersedesRevision },
      target,
    }));
  }
  const add = (type, source) => edges.push(assertResearchEdge({ type, source, target }));
  if (kind === "question") {
    for (const source of node.extendsRefs) add("extends_question", source);
  } else if (kind === "claim") {
    if (node.answerRef) add("yields_claim", node.answerRef);
    for (const relation of node.relations) add(relation.type, relation.source);
  } else if (kind === "answer") {
    add("answers", node.questionRef);
    for (const source of node.additionalInputs) add("derived_from", source);
  } else if (kind === "rebuttal") {
    add("rebuts", node.targetRef);
    for (const source of node.basisRefs) add("grounds_rebuttal", source);
  } else if (kind === "evaluation") {
    add("evaluates", node.subjectRef);
    for (const source of node.basisRefs) add("evaluation_basis", source);
  } else if (kind === "dataset") {
    add("materializes_dataset", node.artifactRef);
  } else if (node.artifactRef !== null) {
    add("packages_tool", node.artifactRef);
  }
  return edges;
}

function createPreparedBinding(document, prepared) {
  const body = typedDocToApi(document);
  return Object.freeze({
    schema: "evimesh.prepared-research-binding.v1",
    producerActorId: prepared?.payload?.producerActorId,
    publisherActorId: prepared?.payload?.publisherActorId,
    signerActorId: prepared?.payload?.signerActorId,
    draftedByActorId: body.draftedByActorId,
    projectId: body.projectId,
    revision: body.revision,
  });
}

function assertPreparedDocumentBinding({ material, document, kind, binding }) {
  const documentBody = typedDocToApi(document);
  const { draftedByActorId, ...node } = documentBody;
  const producerActorId = binding?.producerActorId;
  const publisherActorId = binding?.publisherActorId;
  const signerActorId = binding?.signerActorId;
  if (binding?.schema !== "evimesh.prepared-research-binding.v1"
    || binding.draftedByActorId !== draftedByActorId
    || binding.projectId !== node.projectId
    || binding.revision !== node.revision) {
    const error = new Error("prepared artifact binding does not match its research document");
    error.code = "CLI_PREPARED_DOCUMENT_MISMATCH";
    throw error;
  }
  const canonicalActorId = (value) => typeof value === "string" && value.trim() === value && value.length > 0;
  if (!canonicalActorId(producerActorId)
    || !canonicalActorId(publisherActorId)
    || !canonicalActorId(signerActorId)
    || signerActorId !== publisherActorId) {
    const error = new Error("prepared payload is missing or mismatches its producer, publisher, or signer actor");
    error.code = "CLI_PREPARED_DOCUMENT_MISMATCH";
    throw error;
  }
  const expectedPayload = createTypedResearchCanonicalPayload({
    schema: document.schema,
    entityType: kind,
    producerActorId,
    publisherActorId,
    signerActorId,
    draftedByActorId,
    node,
    incomingEdges: expectedIncomingEdges(kind, node),
  });
  if (canonicalJson(material.payload) !== canonicalJson(expectedPayload)) {
    const error = new Error("prepared payload, incoming edges, or research document binding does not match");
    error.code = "CLI_PREPARED_DOCUMENT_MISMATCH";
    throw error;
  }
  return expectedPayload;
}

function incomingEdgeSummary(edges) {
  if (edges.length === 0) return "(none)";
  const ref = (value) => `${value.kind}:${value.id}@${value.revision}`;
  return edges.map((edge) => `${edge.type} ${ref(edge.source)} -> ${ref(edge.target)}`).join("; ");
}

function promptValue(value, limit = 600) {
  const normalized = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

function semanticPromptLines(kind, node) {
  switch (kind) {
    case "question": return [`title: ${promptValue(node.title)}`, `statement: ${promptValue(node.statement)}`, `problem: ${promptValue(node.researchContract?.problem)}`];
    case "claim": return [`statement: ${promptValue(node.statement)}`, `question: ${promptValue(node.questionId ?? "(none)")}`, `falsified if: ${promptValue((node.falsification ?? []).join("; "))}`];
    case "answer": return [`title: ${promptValue(node.title)}`, `synthesis: ${promptValue(node.synthesis)}`];
    case "rebuttal": return [`title: ${promptValue(node.title)}`, `argument: ${promptValue(node.argument)}`];
    case "evaluation": return [`stance: ${promptValue(node.stance)}`, `rationale: ${promptValue(node.rationale)}`, `method: ${promptValue(node.method ?? "(not stated)")}`];
    case "dataset": return [`name: ${promptValue(node.name)}`, `version: ${promptValue(node.version)}`, `description: ${promptValue(node.description)}`, `license: ${promptValue(node.license)}`];
    case "tool": return [`name: ${promptValue(node.name)}`, `type/version: ${promptValue(node.toolKind)} ${promptValue(node.version)}`, `description: ${promptValue(node.description)}`, `runtime: ${promptValue(node.runtime)}`];
    default: return [];
  }
}

export async function researchDraft({ flags, output, positionals }) {
  const kind = requirePositional(positionals, 0, "kind").toLowerCase();
  if (!OBJECT_KIND[kind]) throw new Error(`unsupported research kind: ${kind}`);
  const id = flagString(flags, "id", createObjectId(OBJECT_KIND[kind]));
  const out = resolve(flagString(flags, "out", `.evimesh/drafts/${id}.${kind}.json`));
  const document = typedResearchTemplate({
    kind,
    id,
    projectId: flagString(flags, "project", flagString(flags, "project-id", "project_TODO")),
    createdBy: flagString(flags, "created-by", "TODO: drafting actor id"),
  });
  writeJson(out, document);
  output.emit({ json: flagBool(flags, "json") }, { kind, id, out, document }, (data) => `${data.kind} draft written to ${data.out}\nnext: edit and validate it; prepare only when \`sq capabilities\` advertises research prepare`);
  return 0;
}

export async function researchPrepare({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  await requirePublicCapability({ client, capability: "research.prepare", command: "sq research prepare" });
  const path = resolve(requirePositional(positionals, 0, "document"));
  const document = readDocument(path);
  validateDocument(document);
  const route = typedSubmissionRoute(document);
  if (!route) throw new Error(`research prepare does not support ${document.schema}`);
  const body = { ...typedDocToApi(document), nonce: flagString(flags, "nonce", createNonce()) };
  const prepared = await preparer(client, route)(body);
  const binding = createPreparedBinding(document, prepared);
  const material = validatePreparedSigningMaterial(prepared);
  assertPreparedDocumentBinding({ material, document, kind: route.kind, binding });
  const artifact = { schema: "srp.prepared-research-submission.v1", kind: route.kind, document, binding, prepared };
  const out = resolve(flagString(flags, "out", defaultDerivedPath(path, "prepared")));
  writeJson(out, artifact);
  output.emit({ json: flagBool(flags, "json") }, { out, ...artifact }, (data) => `prepared canonical ${data.kind} signing payload at ${data.out}\nnext: review it, then run \`sq research sign ${data.out}\``);
  return 0;
}

export async function researchSign({ flags, output, positionals, env = process.env, testInteraction = null }) {
  rejectSigningBypassFlags(flags);
  const path = resolve(requirePositional(positionals, 0, "prepared-document"));
  const artifact = readDocument(path);
  if (artifact?.schema !== "srp.prepared-research-submission.v1" || !artifact.prepared || !typedDocumentDefinition(artifact.document)) throw new Error("expected a prepared typed research submission");
  validateDocument(artifact.document);
  const route = typedSubmissionRoute(artifact.document);
  if (!route || route.kind !== artifact.kind || artifact.prepared.eventType !== route.eventType) {
    const error = new Error("prepared submission kind or event type does not match its research document");
    error.code = "CLI_PREPARED_DOCUMENT_MISMATCH";
    throw error;
  }
  const material = validatePreparedSigningMaterial(artifact.prepared);
  const boundPayload = assertPreparedDocumentBinding({ material, document: artifact.document, kind: route.kind, binding: artifact.binding });
  const key = exportLocalPublicKey(flagString(flags, "key", null), env);
  if (key.state !== "active") {
    const error = new Error("selected local signing key is not active");
    error.code = "CLI_KEY_NOT_ACTIVE";
    throw error;
  }
  const interaction = requireHumanInteraction(testInteraction);
  const pathWarnings = localKeySecurityWarnings(env);
  const signingDigest = material.signingBytesHash.replace(/^sha256:/, "");
  const confirmationPhrase = `SIGN ${signingDigest.slice(0, 12)}`;
  const authorized = await interaction.authorize({
    phrase: confirmationPhrase,
    prompt: [
      `Authorize ${material.eventType}`,
      `kind: ${artifact.kind}`,
      `project: ${boundPayload.node.projectId}`,
      `revision: ${boundPayload.node.revision}`,
      `producer agent: ${boundPayload.producerActorId}`,
      `human publisher/signing actor: ${boundPayload.publisherActorId}`,
      `drafted by: ${boundPayload.draftedByActorId}`,
      ...semanticPromptLines(artifact.kind, boundPayload.node),
      `incoming edges (${boundPayload.incomingEdges.length}): ${incomingEdgeSummary(boundPayload.incomingEdges)}`,
      `signing hash: ${material.signingBytesHash}`,
      `nonce: ${material.nonce}`,
      `key: ${key.keyId} (${key.fingerprint})`,
      ...pathWarnings.map((warning) => `warning: ${warning}`),
    ].join("\n"),
  });
  if (!authorized) {
    const error = new Error("local research signing was cancelled");
    error.code = "CLI_HUMAN_CANCELLED";
    throw error;
  }
  const passphrase = await interaction.secret("Signing-key passphrase: ");
  const unlocked = unlockLocalIdentity({ keyId: key.keyId, passphrase, env });
  let signed;
  try {
    signed = await signSubmission(material, { privateKey: unlocked.privateKey, key: unlocked.public });
  } finally {
    // JavaScript cannot guarantee erasure of runtime/native copies; overwrite the Buffer we directly control.
    unlocked.privateKey.fill(0);
  }
  const signatureEnvelope = {
    schema: "srp.client-signature-envelope.v1",
    event_type: material.eventType,
    payload: material.payload,
    nonce: material.nonce,
    signing_bytes_hash: signed.signingBytesHash,
    signature: signed.signature,
  };
  const result = { schema: "srp.signed-research-submission.v1", kind: artifact.kind, document: artifact.document, signatureEnvelope };
  const out = resolve(flagString(flags, "out", defaultDerivedPath(path, "signed")));
  writeJson(out, result);
  output.emit({ json: flagBool(flags, "json") }, { out, kind: result.kind, signatureEnvelope }, (data) => `human signature written to ${data.out}\nsubmit only when \`sq capabilities\` advertises research submit`);
  return 0;
}

export async function researchSubmit({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  await requirePublicCapability({ client, capability: "research.submit", command: "sq research submit" });
  const path = resolve(requirePositional(positionals, 0, "signed-document"));
  const artifact = readDocument(path);
  if (artifact?.schema !== "srp.signed-research-submission.v1" || !artifact.signatureEnvelope || !typedDocumentDefinition(artifact.document)) throw new Error("expected an externally signed typed research submission");
  validateDocument(artifact.document);
  const route = typedSubmissionRoute(artifact.document);
  const body = { ...typedDocToApi(artifact.document), signatureEnvelope: artifact.signatureEnvelope };
  if (flagBool(flags, "dry-run")) {
    output.emit({ json: flagBool(flags, "json") }, { dryRun: true, route: route.path, body }, (data) => `[dry-run] would POST ${data.route} with an existing external signature`);
    return 0;
  }
  const response = await submitter(client, route)(body);
  output.emit({ json: flagBool(flags, "json") }, { submitted: true, route: route.path, signingBytesHash: artifact.signatureEnvelope.signing_bytes_hash, response }, (data) => `submitted externally signed ${route.kind} to ${data.route}\nsigning hash: ${data.signingBytesHash}`);
  return 0;
}
