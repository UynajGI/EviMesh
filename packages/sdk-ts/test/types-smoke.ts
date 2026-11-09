/**
 * Compile-only smoke test for the generated API types.
 * `tsc --noEmit` must accept this file for M10-02 to hold.
 */
import type {
  AuthMeResponse,
  ContextBundleResponse,
  CreateClaimRequest,
  CreateRunRequest,
  ErrorResponse,
  EviMeshOperationId,
  EviMeshOperations,
  HealthResponse,
  PagedResponse,
  PublicCapabilities,
  SubmitVerificationRequest,
  UploadPlanResponse,
  UploadPlanRequest,
} from "../src/generated/types.d.ts";

const health: HealthResponse = { service: "evimesh-api-edge", status: "ok", environment: "test" };

const capabilities: PublicCapabilities = {
  schemaVersion: "public-capabilities.v1",
  releaseChannel: "preview",
  apiVersion: "0.3.0",
  graphSchemaVersion: "research-neighborhood.v1",
  deviceAuthorization: { enabled: false },
  research: { read: true, prepare: false, submit: false, signing: "human-local-only" },
  clients: {
    sdk: { available: false, minimumVersion: null },
    cli: { available: false, minimumVersion: null },
    mcp: { available: false, minimumVersion: null },
  },
};

const uploadPlanRequest: UploadPlanRequest = { artifactId: "artifact-1", revision: 1, rawHash: `sha256:${"a".repeat(64)}`, sizeBytes: 10, mediaType: "text/plain", fileName: "evidence.txt" };

const me: AuthMeResponse = { subject: "actor-1", email: null, actorId: "actor-1", actorType: "agent", signingKey: null };

const error: ErrorResponse = { code: "CLAIM_NOT_FOUND", message: "claim not found", request_id: "req-1" };

const page: PagedResponse = { items: [{ claimId: "claim-1" }], nextCursor: null };

const bundle: ContextBundleResponse = {
  contextBundleId: "context-1",
  taskId: "task-1",
  taskRevision: 1,
  frontierSnapshotId: "frontier-1",
  mode: "blind",
  manifest: {},
  contentHash: `sha256:${"a".repeat(64)}`,
  storageUri: "r2://evimesh/context-1.json",
};

const claimRequest: CreateClaimRequest = {
  claimId: "claim-1",
  draftedByActorId: "agent-1",
  statement: "The method reproduces within tolerance.",
  scope: ["the dataset"],
  assumptions: [],
  falsification: ["a failed reproduction"],
};

const runRequest: CreateRunRequest = {
  runId: "run-1",
  taskId: "task-1",
  contextBundleId: "context-1",
  sourceCode: "artifact-code@1",
  container: `python@sha256:${"b".repeat(64)}`,
  command: "python",
  environment: { python: "3.12" },
  hardware: { cpu: "x86_64" },
  randomSeed: { seed: 42 },
  startedAt: "2026-08-06T00:00:00.000Z",
  endedAt: "2026-08-06T00:05:00.000Z",
  networkAccess: false,
  exitCode: 0,
  actorId: "agent-1",
  signingKeyId: "key-1",
  signature: "ed25519:sig",
  signatureEnvelope: {
    schema: "srp.client-signature-envelope.v1",
    event_type: "run.created",
    payload: {},
    nonce: "nonce-0123456789abcdef",
    signing_bytes_hash: `sha256:${"a".repeat(64)}`,
    signature: { algorithm: "Ed25519", key_id: "publisher-key", value: "ed25519:outer" },
  },
};

const verificationRequest: SubmitVerificationRequest = {
  receiptId: "receipt-1",
  runId: "run-1",
  claimId: "claim-1",
  claimRevision: 2,
  contractId: "contract-1",
  contractRevision: 1,
  outcome: "supports",
  verificationTypes: ["reproduction"],
  contextMode: "blind",
  sawExpectedOutputs: false,
  implementationRelation: "independent",
  dataRelation: "same_input",
  modelFamily: "none",
  contributionStatementId: "statement-1",
};

const plan: UploadPlanResponse = {
  uploadType: "single",
  key: "artifacts/artifact-1/1",
  sizeBytes: 10,
  mediaType: "text/plain",
  issuedAt: "2026-08-06T00:00:00.000Z",
  expiresAt: "2026-08-06T00:15:00.000Z",
  url: "https://r2.example.test/signed",
};

const operation: EviMeshOperationId = "getTaskContext";
const route: EviMeshOperations[typeof operation] = { method: "GET", path: "/tasks/{taskId}/context" };

export { health, capabilities, me, error, page, bundle, claimRequest, runRequest, verificationRequest, plan, operation, route };
