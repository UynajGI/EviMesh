import test from "node:test";
import assert from "node:assert/strict";
import { signWitnessCheckpoint, verifyWitnessCheckpoint, WITNESS_CHECKPOINT_SCHEMA, WitnessError } from "../src/witness.mjs";
import { createLocalTimestampAdapter, assertTimestampAdapter, storeOtsProof, TimestampAdapterError } from "../src/ots-adapter.mjs";
import { generateEd25519KeyPair } from "../../signatures/src/ed25519.mjs";

const ROOT = `sha256:${"d".repeat(64)}`;

test("witness receipts sign and verify the same checkpoint root", async () => {
  const witnessKey = generateEd25519KeyPair();
  const receipt = await signWitnessCheckpoint({ checkpointId: "checkpoint_1", rootHash: ROOT, witnessId: "witness_org", keyId: "witness-key-1", privateKey: witnessKey.private_key });
  assert.equal(receipt.schema, WITNESS_CHECKPOINT_SCHEMA);
  assert.equal(await verifyWitnessCheckpoint(receipt, { publicKey: witnessKey.public_key }), true);

  const tampered = { ...receipt, rootHash: `sha256:${"e".repeat(64)}` };
  assert.equal(await verifyWitnessCheckpoint(tampered, { publicKey: witnessKey.public_key }), false);

  const otherKey = generateEd25519KeyPair();
  assert.equal(await verifyWitnessCheckpoint(receipt, { publicKey: otherKey.public_key }), false);
});

test("witness receipt validation rejects malformed inputs", async () => {
  await assert.rejects(verifyWitnessCheckpoint({ schema: "wrong" }, { publicKey: "x" }), WitnessError);
  await assert.rejects(
    signWitnessCheckpoint({ checkpointId: "", rootHash: ROOT, witnessId: "w", keyId: "k", privateKey: "p" }),
    WitnessError,
  );
});

test("local OTS adapter submits roots and returns proofs", async () => {
  const adapter = createLocalTimestampAdapter();
  assertTimestampAdapter(adapter);
  const submission = await adapter.submit(ROOT);
  assert.equal(submission.rootHash, ROOT);
  const proof = await adapter.getProof(ROOT);
  assert.equal(proof.rootHash, ROOT);
  assert.equal(proof.adapter, "local");
  assert.equal(await adapter.getProof(`sha256:${"f".repeat(64)}`), null);
  await assert.rejects(adapter.submit("not-a-root"), TimestampAdapterError);
});

test("OTS proofs are stored per checkpoint", async () => {
  const stored = [];
  const repository = { insertOtsProof: async (proof) => { stored.push(proof); return proof; } };
  const adapter = createLocalTimestampAdapter();
  await adapter.submit(ROOT);
  const proof = await adapter.getProof(ROOT);
  await storeOtsProof({ repository, checkpointId: "checkpoint_1", proof });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].checkpointId, "checkpoint_1");
  await assert.rejects(storeOtsProof({ repository: {}, checkpointId: "c", proof }), TimestampAdapterError);
});

test("adapter interface requires name, submit, and getProof", () => {
  assert.throws(() => assertTimestampAdapter({}), TimestampAdapterError);
  assert.throws(() => assertTimestampAdapter({ name: "x" }), TimestampAdapterError);
  assert.throws(() => assertTimestampAdapter({ name: "x", submit: async () => {} }), TimestampAdapterError);
});
