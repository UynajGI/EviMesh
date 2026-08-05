import test from "node:test";
import assert from "node:assert/strict";
import { generateEd25519KeyPair } from "../src/ed25519.mjs";
import { createKeyRotationDeclaration, verifyKeyRotationDeclaration } from "../src/key-rotation.mjs";

test("creates a rotation declaration signed by the old key", async () => {
  const oldKey = generateEd25519KeyPair();
  const newKey = generateEd25519KeyPair();
  const declaration = await createKeyRotationDeclaration({
    oldKeyId: "key_old",
    newKeyId: "key_new",
    newPublicKey: newKey.public_key,
    oldPrivateKey: oldKey.private_key,
  });

  assert.equal(await verifyKeyRotationDeclaration(declaration, oldKey.public_key), true);
  assert.equal(await verifyKeyRotationDeclaration({ ...declaration, new_key_id: "key_tampered" }, oldKey.public_key), false);
});
