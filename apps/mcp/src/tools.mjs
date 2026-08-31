import { randomUUID } from "node:crypto";
import { validateDocument, CliDocumentError, assertCanonicalRunDocument, verificationDocToApi, challengeDocToApi, submissionRoute, typedDocToApi, typedDocumentDefinition, typedSubmissionRoute } from "../../../packages/cli/src/documents.mjs";
import { createObjectId } from "../../../packages/protocol/src/uuidv7.mjs";
import { sha256Bytes } from "../../../packages/artifact/src/hash.mjs";
import { verifyMerkleInclusionProof } from "../../../packages/merkle/src/verify-inclusion-proof.mjs";
import { hashResearchEventLeaf } from "../../../packages/merkle/src/research-event-leaf.mjs";
import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";
import { CONTEXT_MODES } from "./resources.mjs";

export class McpToolError extends Error {
  constructor(message, code = "MCP_TOOL_INVALID") {
    super(message);
    this.name = "McpToolError";
    this.code = code;
  }
}

const STRING = { type: "string" };
const BOOLEAN = { type: "boolean" };
const OBJECT = { type: "object" };
const TYPED_RESEARCH_KINDS = Object.freeze({
  answer: Object.freeze({ schema: "srp.answer.v1", resource: "answers" }),
  rebuttal: Object.freeze({ schema: "srp.rebuttal.v1", resource: "rebuttals" }),
  evaluation: Object.freeze({ schema: "srp.evaluation.v1", resource: "evaluations" }),
  dataset: Object.freeze({ schema: "srp.dataset.v1", resource: "datasets" }),
  tool: Object.freeze({ schema: "srp.tool.v1", resource: "tools" }),
});

export const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;

function requiredArg(value, field) {
  if (value === undefined || value === null || (typeof value === "string" && value.trim().length === 0)) {
    throw new McpToolError(`argument ${field} is required`);
  }
  return value;
}

function requiredObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new McpToolError(`argument ${field} must be a non-empty object`);
  }
  return value;
}

function validateToolDocument(document) {
  try {
    return validateDocument(document);
  } catch (error) {
    if (error instanceof CliDocumentError) {
      const mapped = new McpToolError(error.message, error.code);
      mapped.findings = error.findings;
      throw mapped;
    }
    throw error;
  }
}

function typedResearchKind(kind) {
  const value = TYPED_RESEARCH_KINDS[kind];
  if (!value) throw new McpToolError(`kind must be one of: ${Object.keys(TYPED_RESEARCH_KINDS).join(", ")}`, "RESEARCH_NODE_KIND_INVALID");
  return value;
}

function validateTypedResearchDocument(kind, document) {
  const definition = typedResearchKind(kind);
  validateToolDocument(document);
  if (document.schema !== definition.schema || typedDocumentDefinition(document)?.kind !== kind) {
    throw new McpToolError(`expected ${definition.schema} for ${kind}`, "TYPED_RESEARCH_SCHEMA_MISMATCH");
  }
  return definition;
}

function consentResult(tool, summary) {
  return {
    isError: true,
    structuredContent: {
      error: "consent_required",
      tool,
      message: "This tool writes to the research network. Call it again with confirm: true to execute.",
      summary,
    },
  };
}

function ok(structuredContent) {
  return { isError: false, structuredContent };
}

function createNonce() {
  return Buffer.from(`${Date.now()}:${randomUUID()}`, "utf8").toString("base64url").slice(0, 64);
}

function preparedExternalSignature({ eventType, payload, nonce = createNonce() }) {
  if (typeof nonce !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new McpToolError("nonce must be 16-128 base64url characters", "SIGNATURE_NONCE_INVALID");
  }
  const signingBytes = canonicalJson({ event_type: eventType, payload, nonce });
  return Object.freeze({
    eventType,
    payload,
    nonce,
    signingBytes,
    signingBytesHash: `sha256:${rawHash(signingBytes)}`,
  });
}

function requireExternalSignatureEnvelope(value, { eventType, payload }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new McpToolError("an external human signature envelope is required", "RESEARCH_PUBLISHER_SIGNATURE_REQUIRED");
  }
  const envelope = requiredObject(value, "signatureEnvelope");
  if (envelope.schema !== "srp.client-signature-envelope.v1" || envelope.event_type !== eventType) {
    throw new McpToolError(`an external ${eventType} signature envelope is required`, "RESEARCH_PUBLISHER_SIGNATURE_REQUIRED");
  }
  if (canonicalJson(envelope.payload) !== canonicalJson(payload)) {
    throw new McpToolError("external signature envelope payload does not match the exact submission", "CLIENT_SIGNATURE_PAYLOAD_MISMATCH");
  }
  const expected = preparedExternalSignature({ eventType, payload, nonce: envelope.nonce });
  if (envelope.signing_bytes_hash !== expected.signingBytesHash) {
    throw new McpToolError("external signature envelope signing hash does not match the exact submission", "CLIENT_SIGNATURE_HASH_MISMATCH");
  }
  if (envelope.signature?.algorithm !== "Ed25519" || typeof envelope.signature?.key_id !== "string" || typeof envelope.signature?.value !== "string") {
    throw new McpToolError("an external Ed25519 signature is required", "RESEARCH_PUBLISHER_SIGNATURE_REQUIRED");
  }
  return envelope;
}

async function requireActiveAgentActor(client) {
  const actor = await client.http.request("GET", "/auth/me");
  if (typeof actor?.actorId !== "string" || !actor.actorId) throw new McpToolError("authenticated actor binding is unavailable", "AGENT_ACTOR_MISSING");
  if (actor.actorType !== "agent" && actor.actorType !== "service") {
    throw new McpToolError("MCP drafts require an authenticated agent or service actor", "AGENT_ACTOR_REQUIRED");
  }
  return actor;
}

function failClosedMutation(name) {
  throw new McpToolError(
    `${name} is disabled until its API exposes a canonical prepare and externally signed submit flow`,
    "MCP_SIGNED_MUTATION_UNAVAILABLE",
  );
}

function legacySubmissionPlan(document, options = {}) {
  validateToolDocument(document);
  if (document.schema === "srp.run.v1") assertCanonicalRunDocument(document);
  if (document.schema === "srp.verification-receipt.v1") {
    const runId = requiredArg(options.runId, "runId");
    const receiptId = options.receiptId ?? createObjectId("Verification");
    const contributionStatementId = options.contributionStatementId ?? `statement_${randomUUID()}`;
    return Object.freeze({
      kind: "verification",
      path: "/verifications",
      method: "POST",
      eventType: "verification.submitted",
      body: verificationDocToApi(document, { receiptId, runId, contributionStatementId }),
    });
  }
  const route = submissionRoute(document);
  if (!route) throw new McpToolError(`submission is not supported for schema ${document.schema}`);
  return Object.freeze({
    kind: route.kind,
    path: route.path,
    method: route.method,
    eventType: route.eventType,
    body: route.toApi(document),
  });
}

function jsonContent(data) {
  return [{ type: "text", text: JSON.stringify(data, null, 2) }];
}

const TOOL_DEFINITIONS = [
  {
    name: "inspect_research_neighborhood",
    description: "Read the same bounded, typed research neighborhood used by the graph and categorized relation directory.",
    write: false,
    inputSchema: {
      type: "object",
      required: ["kind", "id"],
      properties: {
        kind: STRING,
        id: STRING,
        revision: { type: "integer", minimum: 1 },
        direction: { type: "string", enum: ["upstream", "downstream", "both"] },
        depth: { type: "integer", minimum: 1, maximum: 3 },
        kinds: { type: "array", items: STRING },
        edgeTypes: { type: "array", items: STRING },
        cursor: STRING,
      },
    },
    outputSchema: { type: "object", required: ["neighborhood"], properties: { neighborhood: OBJECT } },
    run: async ({ client, args }) => {
      requiredArg(args.kind, "kind");
      requiredArg(args.id, "id");
      const neighborhood = await client.researchGraph.neighborhood(args.kind, args.id, {
        revision: args.revision,
        direction: args.direction ?? "both",
        depth: args.depth ?? 1,
        kinds: args.kinds,
        edgeTypes: args.edgeTypes,
        cursor: args.cursor,
      });
      return ok({ neighborhood });
    },
  },
  {
    name: "browse_typed_research_nodes",
    description: "List Answer, Rebuttal, Evaluation, Dataset, or Tool nodes visible to the current caller.",
    write: false,
    inputSchema: {
      type: "object",
      required: ["kind"],
      properties: {
        kind: { type: "string", enum: Object.keys(TYPED_RESEARCH_KINDS) },
        projectId: STRING,
        state: STRING,
        stance: STRING,
        toolKind: STRING,
        limit: { type: "integer", minimum: 1, maximum: 100 },
        cursor: STRING,
      },
    },
    outputSchema: { type: "object", required: ["items"], properties: { items: { type: "array" }, nextCursor: { type: ["string", "null"] } } },
    run: async ({ client, args }) => {
      const definition = typedResearchKind(requiredArg(args.kind, "kind"));
      const page = await client[definition.resource].list({
        projectId: args.projectId,
        state: args.state,
        stance: args.stance,
        toolKind: args.toolKind,
        limit: args.limit,
        cursor: args.cursor,
      });
      return ok({ items: page.items ?? [], nextCursor: page.nextCursor ?? null });
    },
  },
  {
    name: "inspect_typed_research_node",
    description: "Read one typed research node and its immutable current revision.",
    write: false,
    inputSchema: { type: "object", required: ["kind", "id"], properties: { kind: { type: "string", enum: Object.keys(TYPED_RESEARCH_KINDS) }, id: STRING } },
    outputSchema: { type: "object", required: ["detail"], properties: { detail: OBJECT } },
    run: async ({ client, args }) => {
      const definition = typedResearchKind(requiredArg(args.kind, "kind"));
      const detail = await client[definition.resource].get(requiredArg(args.id, "id"));
      return ok({ detail });
    },
  },
  {
    name: "draft_typed_research_node",
    description: "Validate and return an Agent-authored typed research draft. This performs no network mutation and never reads a human private key.",
    write: false,
    inputSchema: { type: "object", required: ["kind", "document"], properties: { kind: { type: "string", enum: Object.keys(TYPED_RESEARCH_KINDS) }, document: OBJECT } },
    outputSchema: { type: "object", required: ["draft"], properties: { draft: OBJECT } },
    run: async ({ args }) => {
      requiredObject(args.document, "document");
      validateTypedResearchDocument(requiredArg(args.kind, "kind"), args.document);
      return ok({ draft: args.document });
    },
  },
  {
    name: "prepare_typed_research_submission",
    description: "Prepare canonical signing bytes for a named human publisher. The Agent receives no private key and cannot sign the result.",
    write: false,
    inputSchema: { type: "object", required: ["kind", "document", "publisherActorId"], properties: { kind: { type: "string", enum: Object.keys(TYPED_RESEARCH_KINDS) }, document: OBJECT, publisherActorId: STRING, nonce: STRING } },
    outputSchema: { type: "object", required: ["prepared"], properties: { prepared: OBJECT } },
    run: async ({ client, args }) => {
      const kind = requiredArg(args.kind, "kind");
      const definition = validateTypedResearchDocument(kind, requiredObject(args.document, "document"));
      const route = typedSubmissionRoute(args.document);
      const prepared = await client[definition.resource].prepare({
        ...typedDocToApi(args.document),
        publisherActorId: requiredArg(args.publisherActorId, "publisherActorId"),
        nonce: args.nonce ?? createNonce(),
      });
      return ok({ kind: route.kind, prepared });
    },
  },
  {
    name: "submit_typed_research_submission",
    description: "Relay an externally human-signed typed research submission. confirm:true gates the network write but can never replace signatureEnvelope.",
    write: true,
    inputSchema: { type: "object", required: ["kind", "document", "signatureEnvelope"], properties: { kind: { type: "string", enum: Object.keys(TYPED_RESEARCH_KINDS) }, document: OBJECT, signatureEnvelope: OBJECT, confirm: BOOLEAN } },
    outputSchema: { type: "object", required: ["submitted", "response"], properties: { submitted: BOOLEAN, response: OBJECT } },
    run: async ({ client, args }) => {
      const kind = requiredArg(args.kind, "kind");
      const definition = validateTypedResearchDocument(kind, requiredObject(args.document, "document"));
      if (!args.signatureEnvelope) throw new McpToolError("an external human signature envelope is required", "RESEARCH_PUBLISHER_SIGNATURE_REQUIRED");
      const signatureEnvelope = requiredObject(args.signatureEnvelope, "signatureEnvelope");
      if (signatureEnvelope.schema !== "srp.client-signature-envelope.v1" || typeof signatureEnvelope.signature !== "object") {
        throw new McpToolError("an external srp.client-signature-envelope.v1 human signature is required", "RESEARCH_PUBLISHER_SIGNATURE_REQUIRED");
      }
      const route = typedSubmissionRoute(args.document);
      const summary = { action: "relay an externally signed typed research submission", kind, route: route.path, signingBytesHash: signatureEnvelope.signing_bytes_hash ?? null };
      if (args.confirm !== true) return consentResult("submit_typed_research_submission", summary);
      const response = await client[definition.resource].submit({ ...typedDocToApi(args.document), signatureEnvelope });
      return ok({ submitted: true, response });
    },
  },
  {
    name: "search_open_tasks",
    description: "Search research tasks that are open for attempts, with optional filters.",
    write: false,
    inputSchema: {
      type: "object",
      properties: {
        status: { ...STRING, description: "Task status filter, e.g. open" },
        tag: { ...STRING, description: "Required tag, e.g. cpu-only" },
        type: { ...STRING, description: "Task type filter" },
        projectId: { ...STRING, description: "Restrict to one project" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
    outputSchema: { type: "object", required: ["tasks"], properties: { tasks: { type: "array" }, nextCursor: { type: ["string", "null"] } } },
    run: async ({ client, args }) => {
      const page = await client.tasks.list({
        status: args.status ?? null,
        tag: args.tag ?? null,
        type: args.type ?? null,
        projectId: args.projectId ?? null,
        limit: args.limit ?? 20,
      });
      return ok({ tasks: page.items ?? [], nextCursor: page.nextCursor ?? null });
    },
  },
  {
    name: "get_task_context",
    description: "Fetch the immutable ContextBundle for one task and mode, with its content hash.",
    write: false,
    inputSchema: {
      type: "object",
      required: ["taskId", "mode"],
      properties: {
        taskId: STRING,
        mode: { type: "string", enum: [...CONTEXT_MODES] },
      },
    },
    outputSchema: { type: "object", required: ["contextBundleId", "contentHash", "mode"], properties: { contextBundleId: STRING, contentHash: STRING, mode: STRING, bundle: OBJECT } },
    run: async ({ client, args }) => {
      requiredArg(args.taskId, "taskId");
      requiredArg(args.mode, "mode");
      const bundle = await client.tasks.context(args.taskId, args.mode);
      return ok({ contextBundleId: bundle.contextBundleId, contentHash: bundle.contentHash ?? null, mode: args.mode, bundle });
    },
  },
  {
    name: "start_attempt",
    description: "Compatibility placeholder. Attempt mutation is fail-closed until a canonical external-envelope API flow exists.",
    write: true,
    inputSchema: {
      type: "object",
      required: ["taskId"],
      properties: {
        taskId: STRING,
        mode: { type: "string", enum: [...CONTEXT_MODES] },
        confirm: BOOLEAN,
      },
    },
    outputSchema: { type: "object", required: ["attemptId", "taskId", "contextBundleId"], properties: { attemptId: STRING, taskId: STRING, contextBundleId: STRING, contextMode: STRING } },
    run: async ({ client, args }) => {
      requiredArg(args.taskId, "taskId");
      const mode = args.mode ?? "frontier";
      const summary = { action: "start an Attempt", taskId: args.taskId, contextMode: mode };
      if (args.confirm !== true) return consentResult("start_attempt", summary);
      return failClosedMutation("start_attempt");
    },
  },
  {
    name: "record_trace",
    description: "Compatibility placeholder. Trace mutation is fail-closed until a canonical external-envelope API flow exists.",
    write: true,
    inputSchema: {
      type: "object",
      required: ["attemptId", "eventType", "payload"],
      properties: {
        attemptId: STRING,
        eventType: { ...STRING, description: "Dotted lowercase event type, e.g. attempt.progress" },
        payload: OBJECT,
        confirm: BOOLEAN,
      },
    },
    outputSchema: { type: "object", required: ["recorded"], properties: { recorded: BOOLEAN, traceEvent: OBJECT } },
    run: async ({ client, args }) => {
      requiredArg(args.attemptId, "attemptId");
      requiredArg(args.eventType, "eventType");
      const summary = { action: "append a public trace event", attemptId: args.attemptId, eventType: args.eventType };
      if (args.confirm !== true) return consentResult("record_trace", summary);
      return failClosedMutation("record_trace");
    },
  },
  {
    name: "create_claim",
    description: "Draft one falsifiable Claim object locally. Nothing is published. Requires confirm: true.",
    write: true,
    inputSchema: {
      type: "object",
      required: ["statement", "scope", "falsification"],
      properties: {
        statement: STRING,
        scope: { type: "array", items: STRING },
        assumptions: { type: "array", items: STRING },
        falsification: { type: "array", items: STRING },
        questionId: STRING,
        confirm: BOOLEAN,
      },
    },
    outputSchema: { type: "object", required: ["draft"], properties: { draft: OBJECT } },
    run: async ({ client, args }) => {
      requiredArg(args.statement, "statement");
      const summary = { action: "create a local Claim draft", statement: args.statement };
      if (args.confirm !== true) return consentResult("create_claim", summary);
      const actor = await requireActiveAgentActor(client);
      const claimId = createObjectId("Claim");
      const draft = {
        schema: "srp.claim.v1",
        claim_id: claimId,
        revision: 1,
        state: "hypothesis",
        statement: args.statement,
        scope: args.scope,
        assumptions: args.assumptions ?? [],
        falsification: args.falsification,
        created_at: new Date().toISOString(),
        created_by: actor.actorId,
      };
      if (args.questionId) draft.question_id = args.questionId;
      validateToolDocument(draft);
      return ok({ draft });
    },
  },
  {
    name: "attach_evidence",
    description: "Validate and hash provided content locally. Evidence publication is fail-closed until a canonical external-envelope API flow exists.",
    write: true,
    inputSchema: {
      type: "object",
      required: ["contentBase64", "mediaType"],
      properties: {
        contentBase64: { ...STRING, description: "Evidence content, base64-encoded" },
        mediaType: STRING,
        artifactType: { ...STRING, description: "One of the protocol artifact types; defaults to dataset" },
        evidenceType: { ...STRING, description: "Evidence type; defaults to dataset" },
        links: { type: "array", items: { type: "object", required: ["claimId", "claimRevision", "relationType"], properties: { claimId: STRING, claimRevision: { type: "integer" }, relationType: STRING } } },
        confirm: BOOLEAN,
      },
    },
    outputSchema: { type: "object", required: ["artifactId", "rawHash", "sizeBytes"], properties: { artifactId: STRING, rawHash: STRING, sizeBytes: { type: "integer" }, key: STRING, evidenceId: { type: ["string", "null"] } } },
    run: async ({ client, args }) => {
      requiredArg(args.contentBase64, "contentBase64");
      requiredArg(args.mediaType, "mediaType");
      const encoded = String(args.contentBase64);
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
        throw new McpToolError("contentBase64 must be valid base64");
      }
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.length > MAX_EVIDENCE_BYTES) {
        throw new McpToolError(`evidence content exceeds the ${MAX_EVIDENCE_BYTES} byte limit`);
      }
      const rawHash = await sha256Bytes(bytes);
      const summary = { action: "upload evidence content and register it", sizeBytes: bytes.length, rawHash, mediaType: args.mediaType };
      if (args.confirm !== true) return consentResult("attach_evidence", summary);
      return failClosedMutation("attach_evidence");
    },
  },
  {
    name: "record_run",
    description: "Compatibility placeholder. Run production requires an external producer signature and is fail-closed in MCP.",
    write: true,
    inputSchema: {
      type: "object",
      required: ["taskId", "contextBundleId", "sourceCode", "container", "command", "environment", "hardware"],
      properties: {
        taskId: STRING,
        contextBundleId: STRING,
        sourceCode: { ...STRING, description: "Artifact or VCS reference for the executed source" },
        container: { ...STRING, description: "Immutable OCI image reference with a sha256 digest" },
        command: STRING,
        args: { type: "array", items: STRING },
        environment: OBJECT,
        hardware: OBJECT,
        randomSeed: OBJECT,
        exitCode: { type: "integer" },
        inputArtifactRefs: { type: "array", items: { ...STRING, description: "artifactId@revision" } },
        outputArtifactRefs: { type: "array", items: { ...STRING, description: "artifactId@revision" } },
        confirm: BOOLEAN,
      },
    },
    outputSchema: { type: "object", required: ["draft"], properties: { draft: OBJECT } },
    run: async ({ args }) => {
      requiredArg(args.taskId, "taskId");
      requiredArg(args.contextBundleId, "contextBundleId");
      requiredArg(args.sourceCode, "sourceCode");
      requiredArg(args.container, "container");
      requiredArg(args.command, "command");
      requiredObject(args.environment, "environment");
      requiredObject(args.hardware, "hardware");
      const summary = { action: "create a local Run Receipt draft", taskId: args.taskId, command: args.command };
      if (args.confirm !== true) return consentResult("record_run", summary);
      return failClosedMutation("record_run");
    },
  },
  {
    name: "validate_submission",
    description: "Validate one protocol document (claim, run, challenge, verification receipt) against its schema. Read-only.",
    write: false,
    inputSchema: { type: "object", required: ["document"], properties: { document: OBJECT } },
    outputSchema: { type: "object", required: ["valid", "findings"], properties: { valid: BOOLEAN, findings: { type: "array" } } },
    run: async ({ args }) => {
      requiredArg(args.document, "document");
      try {
        validateDocument(args.document);
        return ok({ valid: true, findings: [] });
      } catch (error) {
        const findings = Array.isArray(error.findings) ? error.findings : [{ path: "", message: error.message }];
        return ok({ valid: false, findings });
      }
    },
  },
  {
    name: "prepare_submission",
    description: "Prepare canonical signing bytes for a Claim, Run, Challenge, or VerificationReceipt. This is local and never signs the payload.",
    write: false,
    inputSchema: {
      type: "object",
      required: ["document"],
      properties: {
        document: OBJECT,
        runId: STRING,
        receiptId: STRING,
        contributionStatementId: STRING,
        nonce: STRING,
      },
    },
    outputSchema: { type: "object", required: ["prepared"], properties: { prepared: OBJECT } },
    run: async ({ args }) => {
      const plan = legacySubmissionPlan(requiredObject(args.document, "document"), args);
      const prepared = preparedExternalSignature({ eventType: plan.eventType, payload: plan.body, nonce: args.nonce ?? createNonce() });
      return ok({ prepared: { route: plan.path, ...prepared } });
    },
  },
  {
    name: "publish_submission",
    description: "Relay one externally human-signed Claim, Run, or Challenge. confirm:true gates the write but never signs the payload.",
    write: true,
    inputSchema: { type: "object", required: ["document", "signatureEnvelope"], properties: { document: OBJECT, signatureEnvelope: OBJECT, confirm: BOOLEAN } },
    outputSchema: { type: "object", required: ["published", "route"], properties: { published: BOOLEAN, route: STRING, signingBytesHash: STRING, response: OBJECT } },
    run: async ({ client, args }) => {
      const plan = legacySubmissionPlan(requiredObject(args.document, "document"));
      if (plan.kind === "verification") throw new McpToolError("use submit_verification for VerificationReceipt documents");
      const envelope = requireExternalSignatureEnvelope(args.signatureEnvelope, { eventType: plan.eventType, payload: plan.body });
      const summary = { action: "relay an externally signed submission", route: plan.path, eventType: plan.eventType, objectId: plan.body.claimId ?? plan.body.runId ?? plan.body.challengeId };
      if (args.confirm !== true) return consentResult("publish_submission", summary);
      const response = await client.http.request(plan.method, plan.path, { body: { ...plan.body, signatureEnvelope: envelope } });
      return ok({ published: true, route: plan.path, signingBytesHash: envelope.signing_bytes_hash, response });
    },
  },
  {
    name: "submit_verification",
    description: "Relay one externally human-signed VerificationReceipt. confirm:true gates the write but never signs the payload.",
    write: true,
    inputSchema: { type: "object", required: ["document", "runId", "signatureEnvelope"], properties: { document: OBJECT, runId: STRING, signatureEnvelope: OBJECT, confirm: BOOLEAN } },
    outputSchema: { type: "object", required: ["submitted", "receiptId"], properties: { submitted: BOOLEAN, receiptId: STRING, signingBytesHash: STRING, response: OBJECT } },
    run: async ({ client, args }) => {
      if (!args.signatureEnvelope || typeof args.signatureEnvelope !== "object" || Array.isArray(args.signatureEnvelope)) {
        throw new McpToolError("an external human signature envelope is required", "RESEARCH_PUBLISHER_SIGNATURE_REQUIRED");
      }
      const suppliedEnvelope = requiredObject(args.signatureEnvelope, "signatureEnvelope");
      const plan = legacySubmissionPlan(requiredObject(args.document, "document"), {
        runId: requiredArg(args.runId, "runId"),
        receiptId: suppliedEnvelope.payload?.receiptId,
        contributionStatementId: suppliedEnvelope.payload?.contributionStatementId,
      });
      if (plan.kind !== "verification") throw new McpToolError(`expected srp.verification-receipt.v1, got ${args.document.schema}`);
      const envelope = requireExternalSignatureEnvelope(suppliedEnvelope, { eventType: plan.eventType, payload: plan.body });
      const receiptId = plan.body.receiptId;
      const summary = { action: "relay an externally signed VerificationReceipt", receiptId, runId: args.runId, claimRevision: args.document.claim_revision_id };
      if (args.confirm !== true) return consentResult("submit_verification", summary);
      const response = await client.verifications.submit({ ...plan.body, signatureEnvelope: envelope });
      return ok({ submitted: true, receiptId, signingBytesHash: envelope.signing_bytes_hash, response });
    },
  },
  {
    name: "submit_challenge",
    description: "Relay one externally human-signed Challenge against a fixed ClaimRevision. confirm:true never signs the payload.",
    write: true,
    inputSchema: { type: "object", required: ["document", "signatureEnvelope"], properties: { document: OBJECT, signatureEnvelope: OBJECT, confirm: BOOLEAN } },
    outputSchema: { type: "object", required: ["submitted", "challengeId"], properties: { submitted: BOOLEAN, challengeId: STRING, signingBytesHash: STRING, response: OBJECT } },
    run: async ({ client, args }) => {
      validateToolDocument(requiredObject(args.document, "document"));
      if (args.document.schema !== "srp.challenge.v1") throw new McpToolError(`expected srp.challenge.v1, got ${args.document.schema}`);
      const body = challengeDocToApi(args.document);
      const envelope = requireExternalSignatureEnvelope(args.signatureEnvelope, { eventType: "challenge.created", payload: body });
      const summary = { action: "relay an externally signed Challenge", challengeId: body.challengeId, targetClaimRevision: body.targetClaimId + "@" + body.targetClaimRevision };
      if (args.confirm !== true) return consentResult("submit_challenge", summary);
      const response = await client.challenges.create({ ...body, signatureEnvelope: envelope });
      return ok({ submitted: true, challengeId: body.challengeId, signingBytesHash: envelope.signing_bytes_hash, response });
    },
  },
  {
    name: "inspect_provenance",
    description: "Read the Actor → Event → Object → Frontier provenance path for one object revision.",
    write: false,
    inputSchema: { type: "object", required: ["objectType", "objectId", "revision"], properties: { objectType: STRING, objectId: STRING, revision: { type: "integer", minimum: 1 } } },
    outputSchema: { type: "object", required: ["provenance"], properties: { provenance: OBJECT } },
    run: async ({ client, args }) => {
      requiredArg(args.objectType, "objectType");
      requiredArg(args.objectId, "objectId");
      const provenance = await client.contributions.provenance(args.objectType, args.objectId, Number(args.revision) || 1);
      return ok({ provenance });
    },
  },
  {
    name: "verify_inclusion_proof",
    description: "Locally verify one Merkle inclusion proof, optionally binding it to a supplied Event.",
    write: false,
    inputSchema: { type: "object", required: ["proof"], properties: { proof: OBJECT, event: OBJECT } },
    outputSchema: { type: "object", required: ["valid"], properties: { valid: BOOLEAN, reason: { type: ["string", "null"] } } },
    run: async ({ args }) => {
      requiredArg(args.proof, "proof");
      if (!verifyMerkleInclusionProof(args.proof)) return ok({ valid: false, reason: "proof does not reconstruct its root" });
      if (args.event) {
        const normalized = args.event.schema === "srp.event.v1" ? args.event : {
          schema: "srp.event.v1",
          event_id: args.event.eventId ?? args.event.event_id,
          event_type: args.event.eventType ?? args.event.event_type,
          payload: args.event.payload,
          hash: args.event.hash,
          signature: args.event.signature,
          parents: args.event.parents ?? [],
        };
        const leaf = hashResearchEventLeaf(normalized);
        if (leaf !== args.proof.leafHash) return ok({ valid: false, reason: "event leaf hash does not match the proof" });
      }
      return ok({ valid: true, reason: null });
    },
  },
];

export function listTools() {
  return {
    tools: TOOL_DEFINITIONS.map(({ name, description, inputSchema, outputSchema }) => ({ name, description, inputSchema, outputSchema })),
  };
}

export async function callTool({ client, name, args = {}, env = process.env }) {
  const definition = TOOL_DEFINITIONS.find((tool) => tool.name === name);
  if (!definition) throw new McpToolError(`unknown tool: ${name}`, "MCP_TOOL_NOT_FOUND");
  try {
    const result = await definition.run({ client, args, env });
    return { ...result, content: result.content ?? jsonContent(result.structuredContent) };
  } catch (error) {
    if (error instanceof McpToolError || error instanceof CliDocumentError || error?.code === "CLI_IDENTITY_MISSING") {
      const structuredContent = { error: error.code, message: error.message, ...(Array.isArray(error.findings) ? { findings: error.findings } : {}) };
      return { isError: true, structuredContent, content: [{ type: "text", text: `${error.code}: ${error.message}` }] };
    }
    throw error;
  }
}

export function toolNames() {
  return TOOL_DEFINITIONS.map((tool) => tool.name);
}

export function writeToolNames() {
  return TOOL_DEFINITIONS.filter((tool) => tool.write).map((tool) => tool.name);
}
