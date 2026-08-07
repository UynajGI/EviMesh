import { canonicalJson, rawHash } from "../../protocol/src/hash.mjs";
import { signEd25519Payload } from "../../signatures/src/client-signature.mjs";
import { loadIdentity } from "./identity.mjs";

/**
 * Produce a deterministic signing payload for one submission document and
 * sign it with the stored CLI identity. Returns the canonical bytes, their
 * hash, and the signature block ready to embed in a submission envelope.
 */
export async function signSubmission({ eventType, payload, nonce }, { env = process.env, identity = null } = {}) {
  const signer = identity ?? loadIdentity(env);
  const signingBytes = Buffer.from(canonicalJson({ event_type: eventType, payload, nonce }), "utf8");
  const signature = await signEd25519Payload({ signingBytes: new Uint8Array(signingBytes), privateKey: signer.privateKey });
  return Object.freeze({
    signingBytesHash: `sha256:${rawHash(signingBytes.toString("utf8"))}`,
    signature: Object.freeze({
      algorithm: signer.algorithm ?? "Ed25519",
      key_id: signer.keyId,
      value: signature,
    }),
  });
}

export function createNonce(bytes = Buffer.from(`${Date.now()}:${Math.random().toString(16).slice(2)}`)) {
  return Buffer.from(bytes).toString("base64url").slice(0, 64).padEnd(16, "0");
}
