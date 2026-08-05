import { signEd25519Payload } from "./client-signature.mjs";
import { verifyEd25519Payload } from "./server-verification.mjs";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function rotationFields({ oldKeyId, newKeyId, newPublicKey } = {}) {
  return {
    schema: "evimesh.key-rotation.v1",
    old_key_id: requiredText(oldKeyId, "old key id"),
    new_key_id: requiredText(newKeyId, "new key id"),
    new_public_key: requiredText(newPublicKey, "new public key"),
  };
}

function signingBytes(fields) {
  return new TextEncoder().encode(JSON.stringify(fields));
}

export async function createKeyRotationDeclaration({ oldKeyId, newKeyId, newPublicKey, oldPrivateKey } = {}) {
  const fields = rotationFields({ oldKeyId, newKeyId, newPublicKey });
  const signature = await signEd25519Payload({
    signingBytes: signingBytes(fields),
    privateKey: requiredText(oldPrivateKey, "old private key"),
  });
  return Object.freeze({ ...fields, signature });
}

export async function verifyKeyRotationDeclaration(declaration, oldPublicKey) {
  if (!declaration || typeof declaration !== "object") return false;
  const fields = rotationFields({
    oldKeyId: declaration.old_key_id,
    newKeyId: declaration.new_key_id,
    newPublicKey: declaration.new_public_key,
  });
  return verifyEd25519Payload({
    signingBytes: signingBytes(fields),
    signature: declaration.signature,
    publicKey: oldPublicKey,
  });
}
