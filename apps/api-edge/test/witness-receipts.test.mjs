import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { signWitnessCheckpoint } from "../../../packages/frontier-bundle/src/witness.mjs";
import { generateEd25519KeyPair } from "../../../packages/signatures/src/ed25519.mjs";

const ROOT = `sha256:${"d".repeat(64)}`;

function witnessRepository() {
  const stored = [];
  return {
    stored,
    getMerkleCheckpoint: async (checkpointId) => (checkpointId === "checkpoint_1" ? { checkpointId, rootHash: ROOT } : null),
    insertWitnessReceipt: async (receipt) => { stored.push(receipt); return receipt; },
  };
}

async function postReceipt(app, body) {
  return app.fetch(new Request("https://api.example.test/witness-receipts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), {});
}

test("stores a valid witness receipt", async () => {
  const repository = witnessRepository();
  const app = createApp({ repository });
  const witnessKey = generateEd25519KeyPair();
  const receipt = await signWitnessCheckpoint({ checkpointId: "checkpoint_1", rootHash: ROOT, witnessId: "witness_org", keyId: "witness-key-1", privateKey: witnessKey.private_key });
  const response = await postReceipt(app, { receipt, publicKey: witnessKey.public_key });
  assert.equal(response.status, 201, await response.clone().text());
  const body = await response.json();
  assert.equal(body.checkpointId, "checkpoint_1");
  assert.equal(body.witnessId, "witness_org");
  assert.equal(repository.stored.length, 1);
});

test("rejects a receipt whose root does not match the checkpoint", async () => {
  const repository = witnessRepository();
  const app = createApp({ repository });
  const witnessKey = generateEd25519KeyPair();
  const receipt = await signWitnessCheckpoint({ checkpointId: "checkpoint_1", rootHash: `sha256:${"e".repeat(64)}`, witnessId: "witness_org", keyId: "k", privateKey: witnessKey.private_key });
  const response = await postReceipt(app, { receipt, publicKey: witnessKey.public_key });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "WITNESS_ROOT_MISMATCH");
  assert.equal(repository.stored.length, 0);
});

test("rejects a receipt with an invalid signature", async () => {
  const repository = witnessRepository();
  const app = createApp({ repository });
  const signingKey = generateEd25519KeyPair();
  const otherKey = generateEd25519KeyPair();
  const receipt = await signWitnessCheckpoint({ checkpointId: "checkpoint_1", rootHash: ROOT, witnessId: "witness_org", keyId: "k", privateKey: signingKey.private_key });
  const response = await postReceipt(app, { receipt, publicKey: otherKey.public_key });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "WITNESS_SIGNATURE_INVALID");
});

test("returns 404 for an unknown checkpoint", async () => {
  const repository = witnessRepository();
  const app = createApp({ repository });
  const witnessKey = generateEd25519KeyPair();
  const receipt = await signWitnessCheckpoint({ checkpointId: "checkpoint_missing", rootHash: ROOT, witnessId: "w", keyId: "k", privateKey: witnessKey.private_key });
  const response = await postReceipt(app, { receipt, publicKey: witnessKey.public_key });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "WITNESS_CHECKPOINT_NOT_FOUND");
});

test("returns 503 when witness persistence is not configured", async () => {
  const app = createApp({ repository: { getMerkleCheckpoint: async () => null } });
  const witnessKey = generateEd25519KeyPair();
  const receipt = await signWitnessCheckpoint({ checkpointId: "checkpoint_1", rootHash: ROOT, witnessId: "w", keyId: "k", privateKey: witnessKey.private_key });
  const response = await postReceipt(app, { receipt, publicKey: witnessKey.public_key });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "WITNESS_IMPORT_UNAVAILABLE");
});
