import { generateKeyPairSync } from "node:crypto";

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

/**
 * Generate an Ed25519 keypair using interoperable DER encodings.
 *
 * The public key is SPKI DER and the private key is PKCS#8 DER. Both are
 * returned as base64url strings so callers cannot accidentally mutate a
 * shared key buffer.
 */
export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  return Object.freeze({
    algorithm: "Ed25519",
    public_key: encodeBase64Url(publicKey.export({ format: "der", type: "spki" })),
    private_key: encodeBase64Url(privateKey.export({ format: "der", type: "pkcs8" })),
  });
}
