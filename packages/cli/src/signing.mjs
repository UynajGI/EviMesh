import { createPrivateKey, randomBytes, sign as signBytes } from "node:crypto";
import { canonicalJson, rawHash } from "../../protocol/src/hash.mjs";

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export class CliSigningError extends Error {
  constructor(message, code = "CLI_SIGNING_INVALID") {
    super(message);
    this.name = "CliSigningError";
    this.code = code;
  }
}

/** Validate that all server-prepared representations describe the exact same canonical bytes. */
export function validatePreparedSigningMaterial({ eventType, payload, nonce, signingBytes, signingBytesHash } = {}) {
  if (typeof eventType !== "string" || !eventType.trim()) throw new CliSigningError("prepared event type is required", "CLI_PREPARED_EVENT_TYPE");
  if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce)) throw new CliSigningError("prepared nonce is invalid", "CLI_PREPARED_NONCE");
  let canonical;
  try {
    canonical = canonicalJson({ event_type: eventType, payload, nonce });
  } catch {
    throw new CliSigningError("prepared payload is not canonical JSON", "CLI_PREPARED_PAYLOAD");
  }
  if (typeof signingBytes !== "string" || signingBytes !== canonical) {
    throw new CliSigningError("prepared signing bytes do not match the canonical payload", "CLI_PREPARED_BYTES_MISMATCH");
  }
  const expectedHash = `sha256:${rawHash(canonical)}`;
  if (typeof signingBytesHash !== "string" || signingBytesHash !== expectedHash) {
    throw new CliSigningError("prepared signing bytes hash does not match the canonical payload", "CLI_PREPARED_HASH_MISMATCH");
  }
  return Object.freeze({ eventType, payload, nonce, signingBytes: canonical, signingBytesHash: expectedHash });
}

/**
 * Sign already-validated canonical bytes with one unlocked local key. This
 * function never reads config, tokens, environment secrets, or the network.
 */
export async function signSubmission(prepared, { privateKey, key } = {}) {
  if (!(privateKey instanceof Uint8Array) || privateKey.byteLength === 0) {
    throw new CliSigningError("an unlocked local private key is required", "CLI_KEY_NOT_AVAILABLE");
  }
  if (!key || key.algorithm !== "Ed25519" || typeof key.keyId !== "string" || !key.keyId) {
    throw new CliSigningError("local signing-key metadata is invalid", "CLI_KEY_INVALID");
  }
  const material = validatePreparedSigningMaterial(prepared);
  const signingBytes = Buffer.from(material.signingBytes, "utf8");
  let keyObject;
  let signature;
  try {
    keyObject = createPrivateKey({ key: privateKey, format: "der", type: "pkcs8" });
    if (keyObject.asymmetricKeyType !== "ed25519") throw new Error("wrong key type");
    signature = signBytes(null, signingBytes, keyObject).toString("base64url");
  } catch {
    throw new CliSigningError("local Ed25519 signing failed", "CLI_SIGNATURE_FAILED");
  }
  return Object.freeze({
    signingBytesHash: `sha256:${rawHash(signingBytes.toString("utf8"))}`,
    signature: Object.freeze({
      algorithm: "Ed25519",
      key_id: key.keyId,
      value: signature,
    }),
  });
}

export function createNonce(bytes = randomBytes(32)) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 16) throw new CliSigningError("nonce entropy must contain at least 16 bytes", "CLI_NONCE_INVALID");
  return Buffer.from(bytes).toString("base64url").slice(0, 64).padEnd(16, "0");
}
