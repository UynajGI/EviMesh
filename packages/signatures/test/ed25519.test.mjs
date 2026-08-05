import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { generateEd25519KeyPair } from "../src/ed25519.mjs";

test("generates an Ed25519 keypair that signs and verifies a test vector", () => {
  const keyPair = generateEd25519KeyPair();
  const message = Buffer.from("evimesh:m4-09:test-vector", "utf8");
  const privateKey = createPrivateKey({
    key: Buffer.from(keyPair.private_key, "base64url"),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey({
    key: Buffer.from(keyPair.public_key, "base64url"),
    format: "der",
    type: "spki",
  });
  const signature = sign(null, message, privateKey);

  assert.equal(keyPair.algorithm, "Ed25519");
  assert.equal(typeof keyPair.public_key, "string");
  assert.equal(typeof keyPair.private_key, "string");
  assert.equal(verify(null, message, publicKey, signature), true);
  assert.equal(verify(null, Buffer.from("tampered"), publicKey, signature), false);
});

test("generates distinct keypairs", () => {
  const first = generateEd25519KeyPair();
  const second = generateEd25519KeyPair();

  assert.notEqual(first.public_key, second.public_key);
  assert.notEqual(first.private_key, second.private_key);
});
