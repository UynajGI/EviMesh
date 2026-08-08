import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";

const uploadInput = (fileName) => ({ artifactId: "artifact-1", revision: 1, rawHash: `sha256:${"a".repeat(64)}`, sizeBytes: 4, mediaType: "application/octet-stream", fileName });

test("rejects forbidden upload extensions before invoking the signer", async () => {
  let signerCalls = 0;
  const app = createApp({ uploadSigner: async () => { signerCalls += 1; return { url: "https://r2.example.test/signed" }; } });
  const response = await app.fetch(new Request("https://api.example.test/artifacts/upload-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(uploadInput("payload.exe")),
  }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "UPLOAD_MEDIA_TYPE_DENIED");
  assert.equal(signerCalls, 0);
});

test("forwards an allowed file name to the signer path", async () => {
  let received;
  const app = createApp({ uploadSigner: async (input) => { received = input; return { url: "https://r2.example.test/signed" }; } });
  const response = await app.fetch(new Request("https://api.example.test/artifacts/upload-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(uploadInput("evidence.txt")),
  }), {});
  assert.equal(response.status, 201);
  assert.equal(received.mediaType, "application/octet-stream");
  assert.equal(received.sizeBytes, 4);
});
