import { createPrivateKey, sign } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { generateEd25519KeyPair } from "../src/ed25519.mjs";
import { verifyEd25519Payload } from "../src/server-verification.mjs";

test("verifies valid signatures and rejects a wrong signature", async () => {
  const keyPair = generateEd25519KeyPair();
  const signingBytes = new TextEncoder().encode("evimesh:m4-13:payload");
  const privateKey = createPrivateKey({ key: Buffer.from(keyPair.private_key, "base64url"), format: "der", type: "pkcs8" });
  const signature = sign(null, signingBytes, privateKey).toString("base64url");

  assert.equal(await verifyEd25519Payload({ signingBytes, signature, publicKey: keyPair.public_key }), true);
  assert.equal(await verifyEd25519Payload({ signingBytes: new TextEncoder().encode("wrong"), signature, publicKey: keyPair.public_key }), false);
});
