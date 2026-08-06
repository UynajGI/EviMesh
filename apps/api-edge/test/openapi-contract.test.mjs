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
  assert.deepEqual(Object.keys(document.paths).sort(), ["/auth/me", "/health", "/platform/keys", "/tasks/{taskId}/context"]);
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
  assert.deepEqual(document.components.schemas.AuthMeResponse.required, ["subject", "email"]);
  assert.deepEqual(document.components.schemas.PlatformPublicKeysResponse.required, ["active_key_id", "keys"]);
  assert.deepEqual(document.components.schemas.PlatformPublicKey.required, ["key_id", "algorithm", "public_key"]);
  assert.deepEqual(document.components.schemas.ContextBundleResponse.required, ["contextBundleId", "taskId", "taskRevision", "frontierSnapshotId", "mode", "manifest", "contentHash", "storageUri"]);
  assert.deepEqual(document.components.schemas.ErrorResponse.required, ["code", "message", "request_id"]);
  assert.equal(document.components.schemas.HealthResponse.properties.service.const, "evimesh-api-edge");
  assert.equal(document.components.schemas.HealthResponse.properties.status.const, "ok");
});
