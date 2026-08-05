import { createPublicKey, verify } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { generateEd25519KeyPair } from "../src/ed25519.mjs";
import { signEd25519Payload } from "../src/client-signature.mjs";

test("signs protocol signing bytes and rejects tampering", async () => {
  const keyPair = generateEd25519KeyPair();
  const signingBytes = new TextEncoder().encode('{"event_type":"claim.created","nonce":"test-nonce-123456"}');
  const signature = await signEd25519Payload({ signingBytes, privateKey: keyPair.private_key });
  const publicKey = createPublicKey({
    key: Buffer.from(keyPair.public_key, "base64url"),
    format: "der",
    type: "spki",
  });

  assert.equal(
    verify(null, signingBytes, publicKey, Buffer.from(signature, "base64url")),
    true,
  );
  assert.equal(
    verify(null, new TextEncoder().encode("tampered"), publicKey, Buffer.from(signature, "base64url")),
    false,
  );
});
