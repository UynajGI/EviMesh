import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { RESEARCH_EDGE_TYPES, RESEARCH_NODE_KINDS } from "../../../packages/protocol/src/research-graph.mjs";

const openapiPath = fileURLToPath(new URL("../openapi.json", import.meta.url));
const document = JSON.parse(await readFile(openapiPath, "utf8"));

test("publishes the current API route contract", () => {
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document.info.title, "EviMesh API Edge");
  assert.equal(document.info.version, "0.3.0");
  assert.deepEqual(Object.keys(document.paths).sort(), [
    "/actors",
    "/actors/managed",
    "/actors/managed/{agentActorId}",
    "/actors/self",
    "/actors/{actorId}",
    "/answers",
    "/answers/prepare",
    "/answers/{id}",
    "/api-tokens",
    "/api-tokens/{tokenId}",
    "/artifacts",
    "/artifacts/upload-plan",
    "/artifacts/{artifactId}",
    "/artifacts/{artifactId}/revisions/{revision}",
    "/attempts/{attemptId}",
    "/attempts/{attemptId}/trace",
    "/attempts/{attemptId}/transitions",
    "/auth/device",
    "/auth/device/approve",
    "/auth/device/deny",
    "/auth/device/grants/{userCode}",
    "/auth/device/token",
    "/auth/me",
    "/challenges",
    "/challenges/{challengeId}",
    "/challenges/{challengeId}/transitions",
    "/checkpoints/{checkpointId}",
    "/claims",
    "/claims/{claimId}",
    "/claims/{claimId}/graph",
    "/claims/{claimId}/revisions",
    "/claims/{claimId}/revisions/{revision}",
    "/claims/{claimId}/transitions",
    "/claims/{claimId}/verifications",
    "/datasets",
    "/datasets/prepare",
    "/datasets/{id}",
    "/evaluations",
    "/evaluations/prepare",
    "/evaluations/{id}",
    "/events",
    "/events/export",
    "/events/{eventId}/proof",
    "/evidence",
    "/evidence/{evidenceId}",
    "/evidence/{evidenceId}/links",
    "/health",
    "/health/dependencies",
    "/interactions/mine",
    "/interactions/{objectType}/{objectId}",
    "/merge-proposals/{proposalId}",
    "/meta/capabilities",
    "/onboarding/complete",
    "/platform/keys",
    "/profile",
    "/project-applications",
    "/project-applications/{applicationId}/decision",
    "/project-applications/{applicationId}/withdraw",
    "/project-invitations",
    "/project-invitations/{invitationId}/respond",
    "/projects",
    "/projects/{projectId}",
    "/projects/{projectId}/agents",
    "/projects/{projectId}/agents/{agentActorId}",
    "/projects/{projectId}/frontier/diff",
    "/projects/{projectId}/frontier/history",
    "/projects/{projectId}/frontier/latest",
    "/projects/{projectId}/invitations",
    "/projects/{projectId}/invitations/{invitationId}/revoke",
    "/projects/{projectId}/members",
    "/projects/{projectId}/members/{actorId}",
    "/projects/{projectId}/revisions",
    "/provenance/{objectType}/{objectId}",
    "/questions",
    "/questions/{questionId}",
    "/questions/{questionId}/transitions",
    "/rebuttals",
    "/rebuttals/prepare",
    "/rebuttals/{id}",
    "/recommendations",
    "/research-graph/{kind}/{id}/neighborhood",
    "/research/claims",
    "/research/claims/prepare",
    "/research/questions",
    "/research/questions/prepare",
    "/runs",
    "/runs/{runId}",
    "/signing-keys",
    "/signing-keys/{keyId}",
    "/tasks",
    "/tasks/{taskId}",
    "/tasks/{taskId}/attempts",
    "/tasks/{taskId}/context",
    "/tasks/{taskId}/lease",
    "/tools",
    "/tools/prepare",
    "/tools/{id}",
    "/verifications",
    "/verifications/prepare",
    "/verifications/{receiptId}",
    "/witness-receipts",
  ]);
  assert.deepEqual(Object.keys(document.paths["/health"]).sort(), ["get"]);
  assert.deepEqual(Object.keys(document.paths["/meta/capabilities"]).sort(), ["get"]);
  assert.deepEqual(Object.keys(document.paths["/auth/me"]).sort(), ["get"]);
  assert.deepEqual(Object.keys(document.paths["/tasks/{taskId}/context"]).sort(), ["get"]);
  assert.deepEqual(document.paths["/health"].get.responses["200"].content["application/json"].schema, { $ref: "#/components/schemas/HealthResponse" });
  assert.deepEqual(document.paths["/meta/capabilities"].get.responses["200"].content["application/json"].schema, { $ref: "#/components/schemas/PublicCapabilities" });
  assert.deepEqual(document.paths["/auth/me"].get.security, [{ bearerAuth: [] }]);
  assert.deepEqual(document.paths["/platform/keys"].get.responses["200"].content["application/json"].schema, { $ref: "#/components/schemas/PlatformPublicKeysResponse" });
  assert.deepEqual(document.paths["/tasks/{taskId}/context"].get.parameters.map(({ name, in: location, required }) => ({ name, location, required })), [
    { name: "taskId", location: "path", required: true },
    { name: "mode", location: "query", required: true },
  ]);
  assert.deepEqual(Object.keys(document.components.securitySchemes), ["bearerAuth"]);
});

test("keeps the stable response shapes in the contract", () => {
  assert.deepEqual(document.components.schemas.HealthResponse.required, ["service", "status", "environment"]);
  assert.deepEqual(document.components.schemas.PublicCapabilities.required, ["schemaVersion", "releaseChannel", "apiVersion", "graphSchemaVersion", "deviceAuthorization", "research", "clients"]);
  assert.deepEqual(document.components.schemas.AuthMeResponse.required, ["subject", "email", "actorId", "signingKey"]);
  assert.deepEqual(document.components.schemas.PlatformPublicKeysResponse.required, ["active_key_id", "keys"]);
  assert.deepEqual(document.components.schemas.PlatformPublicKey.required, ["key_id", "algorithm", "public_key"]);
  assert.deepEqual(document.components.schemas.CompleteOnboardingRequest.required, ["termsVersion", "displayName"]);
  assert.deepEqual(document.components.schemas.SigningKeyListResponse.required, ["items"]);
  assert.deepEqual(document.components.schemas.SubmitProjectApplicationRequest.required, ["proposedProjectId", "name", "summary", "license"]);
  assert.equal(document.components.schemas.CompleteOnboardingRequest.additionalProperties, false);
  assert.equal(document.components.schemas.SubmitProjectApplicationRequest.additionalProperties, false);
  assert.equal(document.components.schemas.RegisterSigningKeyRequest.properties.privateKey, undefined);
  assert.match(document.paths["/onboarding/complete"].post.description, /Actor and Auth subject from the Supabase session/);
  assert.match(document.paths["/project-applications/{applicationId}/decision"].post.description, /503 until the atomic signed Graph\/Event/);
  assert.deepEqual(document.components.schemas.ContextBundleResponse.required, ["contextBundleId", "taskId", "taskRevision", "frontierSnapshotId", "mode", "manifest", "contentHash", "storageUri"]);
  assert.deepEqual(document.components.schemas.ErrorResponse.required, ["code", "message", "request_id"]);
  assert.equal(document.components.schemas.HealthResponse.properties.service.const, "evimesh-api-edge");
  assert.equal(document.components.schemas.HealthResponse.properties.status.const, "ok");
  assert.match(document.components.schemas.CreateRunRequest.properties.signature.description, /ascending full artifactId@artifactRevision strings/);
  assert.match(document.components.schemas.CreateRunRequest.properties.signature.description, /non-empty strings without leading or trailing whitespace/);
  assert.match(document.components.schemas.CreateRunRequest.properties.signature.description, /Date\.toISOString/);
  assert.ok(document.components.schemas.CreateRunRequest.required.includes("actorId"));
  assert.ok(document.components.schemas.CreateRunRequest.required.includes("signatureEnvelope"));
  assert.ok(document.components.schemas.CreateRunRequest.required.includes("environment"));
  assert.ok(document.components.schemas.CreateRunRequest.required.includes("hardware"));
  assert.ok(document.components.schemas.CreateRunRequest.required.includes("randomSeed"));
  assert.ok(document.components.schemas.CreateRunRequest.required.includes("networkAccess"));
  assert.ok(!document.components.schemas.CreateRunRequest.required.includes("args"));
  assert.match(document.components.schemas.CreateRunRequest.properties.actorId.description, /agent or service/);
  assert.match(document.components.schemas.CreateRunRequest.properties.signatureEnvelope.description, /human publisher/);
  assert.match(document.components.schemas.CreateClaimRequest.properties.draftedByActorId.description, /created_by/);
  assert.match(document.components.schemas.CreateClaimRequest.properties.draftedByActorId.description, /signatureEnvelope/);
  assert.match(document.components.schemas.CreateClaimRequest.properties.draftedByActorId.description, /agent or service/);
});

test("publishes the fixed deny-by-default API token policy", () => {
  const policy = document["x-evimesh-api-token-policy"];
  assert.deepEqual(policy.registry, [
    "profile:read",
    "project:read",
    "research:prepare",
    "research:submit",
    "artifact:upload",
  ]);
  assert.equal(policy.denyByDefault, true);
  assert.equal(policy.researchSignScopeExists, false);
  assert.equal(policy.tokenManagement, "human-supabase-session-only");
  assert.equal(policy.legacyResearchMutation, "unavailable-in-public-product-mode");
  assert.equal(document.paths["/auth/me"].get["x-evimesh-api-token-scope"], "profile:read");
  assert.equal(document.paths["/artifacts/upload-plan"].post["x-evimesh-api-token-scope"], "artifact:upload");
  for (const plural of ["answers", "rebuttals", "evaluations", "datasets", "tools"]) {
    assert.equal(document.paths[`/${plural}/prepare`].post["x-evimesh-api-token-scope"], "research:prepare");
    assert.equal(document.paths[`/${plural}`].post["x-evimesh-api-token-scope"], "research:submit");
  }
  for (const plural of ["questions", "claims"]) {
    assert.equal(document.paths[`/research/${plural}/prepare`].post["x-evimesh-api-token-scope"], "research:prepare");
    assert.equal(document.paths[`/research/${plural}`].post["x-evimesh-api-token-scope"], "research:submit");
  }
  assert.equal(document.paths["/api-tokens"].post.deprecated, true);
  assert.deepEqual(Object.keys(document.paths["/api-tokens"].post.responses), ["503"]);
});

test("keeps the public graph enums synchronized with the protocol registry", () => {
  assert.deepEqual(document.components.schemas.ResearchNodeKind.enum, RESEARCH_NODE_KINDS);
  assert.deepEqual(document.components.schemas.ResearchEdgeType.enum, RESEARCH_EDGE_TYPES);
});

test("gives every operation a stable id and guards all write operations with bearer auth", () => {
  // Artifact upload plans require an Agent API token with artifact:upload.
  // The RFC-8628 device grant start/poll endpoints are public by design; only approval
  // and the issued limited-scope token require authentication.
  // Witness receipts are submitted by third parties and authenticate via their
  // own Ed25519 signature over the checkpoint root, not a bearer token.
  const publicWrites = new Set(["post /auth/device", "post /auth/device/token", "post /witness-receipts"]);
  const operationIds = new Set();
  for (const [path, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (method === "parameters") continue;
      assert.equal(typeof operation.operationId, "string", `${method.toUpperCase()} ${path} needs an operationId`);
      assert.ok(operation.operationId.length > 0, `${method.toUpperCase()} ${path} needs a non-empty operationId`);
      assert.ok(!operationIds.has(operation.operationId), `duplicate operationId: ${operation.operationId}`);
      operationIds.add(operation.operationId);
      if (["post", "patch", "put", "delete"].includes(method) && !publicWrites.has(`${method} ${path}`)) {
        assert.deepEqual(operation.security, [{ bearerAuth: [] }], `${method.toUpperCase()} ${path} must require bearer auth`);
      }
    }
  }
  assert.ok(operationIds.size >= 50);
});
