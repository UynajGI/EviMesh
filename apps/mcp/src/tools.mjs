import { randomUUID } from "node:crypto";
import { validateDocument, claimDocToApi, runDocToApi, verificationDocToApi, challengeDocToApi, submissionRoute } from "../../../packages/cli/src/documents.mjs";
import { signSubmission, createNonce } from "../../../packages/cli/src/signing.mjs";
import { loadIdentity, CliIdentityError } from "../../../packages/cli/src/identity.mjs";
import { createObjectId } from "../../../packages/protocol/src/uuidv7.mjs";
import { sha256Bytes } from "../../../packages/artifact/src/hash.mjs";
import { verifyMerkleInclusionProof } from "../../../packages/merkle/src/verify-inclusion-proof.mjs";
import { hashResearchEventLeaf } from "../../../packages/merkle/src/research-event-leaf.mjs";
import { canonicalJson } from "../../../packages/protocol/src/hash.mjs";
import { signEd25519Payload } from "../../../packages/signatures/src/client-signature.mjs";
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

function signatureEnvelope({ eventType, body, env }) {
  const nonce = createNonce();
  return signSubmission({ eventType, payload: body, nonce }, { env }).then((signed) => ({
    schema: "srp.client-signature-envelope.v1",
    event_type: eventType,
    payload: body,
    nonce,
    signing_bytes_hash: signed.signingBytesHash,
    signature: signed.signature,
  }));
}

function requireIdentity(env) {
  try {
    return loadIdentity(env);
  } catch (error) {
    if (error instanceof CliIdentityError) {
      throw new McpToolError("no signing identity configured; run `sq identity generate` first", "IDENTITY_MISSING");
    }
    throw error;
  }
}

function requireAgentIdentity(env) {
  const identity = requireIdentity(env);
  if (typeof identity.did !== "string" || !identity.did.startsWith("did:key:")) {
    throw new McpToolError("configured signing identity has no DID binding; regenerate it with `sq identity generate`", "IDENTITY_BINDING_MISSING");
  }
  return identity;
}

async function signRunDraft(unsignedDraft, identity) {
  const signingBytes = Buffer.from(canonicalJson(unsignedDraft), "utf8");
  return signEd25519Payload({ signingBytes: new Uint8Array(signingBytes), privateKey: identity.privateKey });
}

function jsonContent(data) {
  return [{ type: "text", text: JSON.stringify(data, null, 2) }];
}

const TOOL_DEFINITIONS = [
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
    description: "Start one Attempt for a task in a context mode. Requires confirm: true.",
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
      const bundle = await client.tasks.context(args.taskId, mode);
      const attempt = await client.attempts.start(args.taskId, {
        attemptId: `attempt_${randomUUID()}`,
        contextBundleId: bundle.contextBundleId,
        contextMode: mode,
      });
      return ok({ attemptId: attempt.attempt?.attemptId ?? attempt.attemptId, taskId: args.taskId, contextBundleId: bundle.contextBundleId, contextMode: mode });
    },
  },
  {
    name: "record_trace",
    description: "Append one public-summary trace event to an active Attempt. Requires confirm: true.",
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
      const traceEvent = await client.attempts.recordTrace(args.attemptId, {
        eventId: `trace_${randomUUID()}`,
        eventType: args.eventType,
        payload: args.payload ?? {},
      });
      return ok({ recorded: true, traceEvent });
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
    run: async ({ args, env }) => {
      requiredArg(args.statement, "statement");
      const summary = { action: "create a local Claim draft", statement: args.statement };
      if (args.confirm !== true) return consentResult("create_claim", summary);
      const identity = requireAgentIdentity(env);
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
        created_by: identity.did,
      };
      if (args.questionId) draft.question_id = args.questionId;
      validateDocument(draft);
      return ok({ draft });
    },
  },
  {
    name: "attach_evidence",
    description: "Hash provided content, upload it to object storage, and attach it as Evidence. Requires confirm: true.",
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
      const artifactId = `artifact_${randomUUID()}`;
      const plan = await client.artifacts.uploadPlan({ artifactId, revision: 1, rawHash, sizeBytes: bytes.length, mediaType: args.mediaType });
      await client.artifacts.upload(plan, new Uint8Array(bytes));
      let evidenceId = null;
      if (Array.isArray(args.links) && args.links.length > 0) {
        evidenceId = createObjectId("Evidence");
        await client.evidence.create({ evidenceId, evidenceType: args.evidenceType ?? "dataset", artifactId, artifactRevision: 1, links: args.links });
      }
      return ok({ artifactId, rawHash, sizeBytes: bytes.length, key: plan.key, evidenceId });
    },
  },
  {
    name: "record_run",
    description: "Draft one Run Receipt object locally. Nothing is published. Requires confirm: true.",
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
    run: async ({ args, env }) => {
      requiredArg(args.taskId, "taskId");
      requiredArg(args.contextBundleId, "contextBundleId");
      requiredArg(args.sourceCode, "sourceCode");
      requiredArg(args.container, "container");
      requiredArg(args.command, "command");
      requiredObject(args.environment, "environment");
      requiredObject(args.hardware, "hardware");
      const summary = { action: "create a local Run Receipt draft", taskId: args.taskId, command: args.command };
      if (args.confirm !== true) return consentResult("record_run", summary);
      const identity = requireAgentIdentity(env);
      const now = new Date().toISOString();
      const unsignedDraft = {
        schema: "srp.run.v1",
        run_id: createObjectId("Run"),
        task_id: args.taskId,
        context_bundle_id: args.contextBundleId,
        input_artifact_ids: args.inputArtifactRefs ?? [],
        source_code: args.sourceCode,
        container: args.container,
        command: args.command,
        args: args.args ?? [],
        environment: args.environment ?? {},
        hardware: args.hardware ?? {},
        random_seed: args.randomSeed ?? {},
        started_at: now,
        ended_at: now,
        network_access: false,
        output_artifact_ids: args.outputArtifactRefs ?? [],
        exit_code: args.exitCode ?? 0,
        actor_id: identity.did,
      };
      const draft = { ...unsignedDraft, signature: await signRunDraft(unsignedDraft, identity) };
      validateDocument(draft);
      return ok({ draft });
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
    name: "publish_submission",
    description: "Validate, sign, and publish one Claim, Run, or Challenge document. Only executes with confirm: true.",
    write: true,
    inputSchema: { type: "object", required: ["document"], properties: { document: OBJECT, confirm: BOOLEAN } },
    outputSchema: { type: "object", required: ["published", "route"], properties: { published: BOOLEAN, route: STRING, signingBytesHash: STRING, response: OBJECT } },
    run: async ({ client, args, env }) => {
      requiredArg(args.document, "document");
      validateDocument(args.document);
      const route = submissionRoute(args.document);
      if (!route) throw new McpToolError(`submission is not supported for schema ${args.document.schema}`);
      const body = route.toApi(args.document);
      const summary = { action: "sign and publish a submission", route: route.path, eventType: route.eventType, objectId: body.claimId ?? body.runId ?? body.challengeId };
      if (args.confirm !== true) return consentResult("publish_submission", summary);
      requireIdentity(env);
      const envelope = await signatureEnvelope({ eventType: route.eventType, body, env });
      const response = await client.http.request(route.method, route.path, { body: { ...body, signatureEnvelope: envelope } });
      return ok({ published: true, route: route.path, signingBytesHash: envelope.signing_bytes_hash, response });
    },
  },
  {
    name: "submit_verification",
    description: "Sign and submit one VerificationReceipt document, locking the referenced ClaimRevision. Requires confirm: true.",
    write: true,
    inputSchema: { type: "object", required: ["document", "runId"], properties: { document: OBJECT, runId: STRING, receiptId: STRING, confirm: BOOLEAN } },
    outputSchema: { type: "object", required: ["submitted", "receiptId"], properties: { submitted: BOOLEAN, receiptId: STRING, signingBytesHash: STRING, response: OBJECT } },
    run: async ({ client, args, env }) => {
      requiredArg(args.document, "document");
      requiredArg(args.runId, "runId");
      validateDocument(args.document);
      if (args.document.schema !== "srp.verification-receipt.v1") throw new McpToolError(`expected srp.verification-receipt.v1, got ${args.document.schema}`);
      const receiptId = args.receiptId ?? createObjectId("Verification");
      const summary = { action: "sign and submit a VerificationReceipt", receiptId, runId: args.runId, claimRevision: args.document.claim_revision_id };
      if (args.confirm !== true) return consentResult("submit_verification", summary);
      requireIdentity(env);
      const body = verificationDocToApi(args.document, { receiptId, runId: args.runId, contributionStatementId: `statement_${randomUUID()}` });
      const envelope = await signatureEnvelope({ eventType: "verification.submitted", body, env });
      const response = await client.verifications.submit({ ...body, signatureEnvelope: envelope });
      return ok({ submitted: true, receiptId, signingBytesHash: envelope.signing_bytes_hash, response });
    },
  },
  {
    name: "submit_challenge",
    description: "Sign and submit one Challenge document against a fixed ClaimRevision. Requires confirm: true.",
    write: true,
    inputSchema: { type: "object", required: ["document"], properties: { document: OBJECT, confirm: BOOLEAN } },
    outputSchema: { type: "object", required: ["submitted", "challengeId"], properties: { submitted: BOOLEAN, challengeId: STRING, signingBytesHash: STRING, response: OBJECT } },
    run: async ({ client, args, env }) => {
      requiredArg(args.document, "document");
      validateDocument(args.document);
      if (args.document.schema !== "srp.challenge.v1") throw new McpToolError(`expected srp.challenge.v1, got ${args.document.schema}`);
      const body = challengeDocToApi(args.document);
      const summary = { action: "sign and submit a Challenge", challengeId: body.challengeId, targetClaimRevision: body.targetClaimId + "@" + body.targetClaimRevision };
      if (args.confirm !== true) return consentResult("submit_challenge", summary);
      requireIdentity(env);
      const envelope = await signatureEnvelope({ eventType: "challenge.created", body, env });
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
    if (error instanceof McpToolError || error?.code === "CLI_DOCUMENT_INVALID" || error?.code === "CLI_IDENTITY_MISSING") {
      return { isError: true, structuredContent: { error: error.code, message: error.message }, content: [{ type: "text", text: `${error.code}: ${error.message}` }] };
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
