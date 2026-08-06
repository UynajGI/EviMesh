import { canonicalJson, semanticHash } from "../../../packages/protocol/src/hash.mjs";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

export class ContextBundleHashError extends Error {
  constructor(message, code = "CONTEXT_BUNDLE_HASH_INVALID") {
    super(message);
    this.name = "ContextBundleHashError";
    this.code = code;
  }
}

function requiredBundle(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContextBundleHashError("context bundle must be a JSON object");
  }
  return value;
}

function requiredHash(value) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new ContextBundleHashError("context bundle hash must be a lowercase sha256 digest");
  }
  return value;
}

/** Return the canonical bytes that a downloaded ContextBundle must verify. */
export function canonicalContextBundleJson(bundle) {
  try {
    return canonicalJson(requiredBundle(bundle));
  } catch (error) {
    if (error instanceof ContextBundleHashError) throw error;
    throw new ContextBundleHashError(error.message);
  }
}

/** Calculate the stable, transport-independent ContextBundle content hash. */
export function hashContextBundle(bundle) {
  canonicalContextBundleJson(bundle);
  return `sha256:${semanticHash(bundle)}`;
}

/** Verify downloaded ContextBundle content before it is trusted or executed. */
export function verifyContextBundleHash({ bundle, expectedHash } = {}) {
  expectedHash = requiredHash(expectedHash);
  const actualHash = hashContextBundle(bundle);
  if (actualHash !== expectedHash) {
    throw new ContextBundleHashError("downloaded ContextBundle hash does not match", "CONTEXT_BUNDLE_HASH_MISMATCH");
  }
  return Object.freeze({ verified: true, contentHash: actualHash });
}
