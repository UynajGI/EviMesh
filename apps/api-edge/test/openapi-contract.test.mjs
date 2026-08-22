import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const openapiPath = fileURLToPath(new URL("../openapi.json", import.meta.url));
const document = JSON.parse(await readFile(openapiPath, "utf8"));

test("publishes the current API route contract", () => {
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document.info.title, "EviMesh API Edge");
  assert.equal(document.info.version, "0.3.0");
  assert.deepEqual(Object.keys(document.paths).sort(), [
    "/actors",
    "/actors/self",
    "/actors/{actorId}",
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
    "/events",
    "/events/export",
    "/events/{eventId}/proof",
    "/evidence",
    "/evidence/{evidenceId}",
    "/evidence/{evidenceId}/links",
    "/health",
    "/interactions/mine",
    "/interactions/{objectType}/{objectId}",
    "/merge-proposals/{proposalId}",
    "/platform/keys",
    "/profile",
    "/projects",
    "/projects/{projectId}",
    "/projects/{projectId}/frontier/diff",
    "/projects/{projectId}/frontier/history",
    "/projects/{projectId}/frontier/latest",
    "/projects/{projectId}/revisions",
    "/provenance/{objectType}/{objectId}",
    "/questions",
    "/questions/{questionId}",
    "/questions/{questionId}/transitions",
    "/recommendations",
    "/runs",
    "/runs/{runId}",
    "/signing-keys",
    "/tasks",
    "/tasks/{taskId}",
    "/tasks/{taskId}/attempts",
    "/tasks/{taskId}/context",
    "/tasks/{taskId}/lease",
    "/verifications",
    "/verifications/prepare",
    "/verifications/{receiptId}",
    "/witness-receipts",
  ]);
  assert.deepEqual(Object.keys(document.paths["/health"]).sort(), ["get"]);
  assert.deepEqual(Object.keys(document.paths["/auth/me"]).sort(), ["get"]);
  assert.deepEqual(Object.keys(document.paths["/tasks/{taskId}/context"]).sort(), ["get"]);
  assert.deepEqual(document.paths["/health"].get.responses["200"].content["application/json"].schema, { $ref: "#/components/schemas/HealthResponse" });
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
  assert.deepEqual(document.components.schemas.AuthMeResponse.required, ["subject", "email", "actorId"]);
  assert.deepEqual(document.components.schemas.PlatformPublicKeysResponse.required, ["active_key_id", "keys"]);
  assert.deepEqual(document.components.schemas.PlatformPublicKey.required, ["key_id", "algorithm", "public_key"]);
  assert.deepEqual(document.components.schemas.ContextBundleResponse.required, ["contextBundleId", "taskId", "taskRevision", "frontierSnapshotId", "mode", "manifest", "contentHash", "storageUri"]);
  assert.deepEqual(document.components.schemas.ErrorResponse.required, ["code", "message", "request_id"]);
  assert.equal(document.components.schemas.HealthResponse.properties.service.const, "evimesh-api-edge");
  assert.equal(document.components.schemas.HealthResponse.properties.status.const, "ok");
});

test("gives every operation a stable id and guards all write operations with bearer auth", () => {
  // The browser upload panel requests signed upload plans before sign-in exists on that page;
  // plans are bounded by expiry and content-addressed keys, so this stays the one open write.
  // The RFC-8628 device grant start/poll endpoints are public by design; only approval
  // and the issued limited-scope token require authentication.
  // Witness receipts are submitted by third parties and authenticate via their
  // own Ed25519 signature over the checkpoint root, not a bearer token.
  const publicWrites = new Set(["post /artifacts/upload-plan", "post /auth/device", "post /auth/device/token", "post /witness-receipts"]);
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
