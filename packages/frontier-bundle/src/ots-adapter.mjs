/**
 * OpenTimestamps adapter interface (M12-22). Implementations submit a
 * checkpoint root to a timestamping authority and later return a proof.
 * M12-23: proofs are stored per checkpoint and exported with the bundle.
 */
export class TimestampAdapterError extends Error {
  constructor(message, code = "TIMESTAMP_ADAPTER_INVALID") {
    super(message);
    this.name = "TimestampAdapterError";
    this.code = code;
  }
}

export function assertTimestampAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") throw new TimestampAdapterError("adapter is required");
  if (typeof adapter.name !== "string" || adapter.name.length === 0) throw new TimestampAdapterError("adapter name is required");
  if (typeof adapter.submit !== "function") throw new TimestampAdapterError("adapter submit is required");
  if (typeof adapter.getProof !== "function") throw new TimestampAdapterError("adapter getProof is required");
  return adapter;
}

/**
 * Local, dependency-free adapter used in tests and offline environments.
 * It records submissions in memory and produces a deterministic proof stub.
 */
export function createLocalTimestampAdapter({ now = () => new Date() } = {}) {
  const submissions = new Map();
  return Object.freeze({
    name: "local",
    async submit(rootHash) {
      if (typeof rootHash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(rootHash)) {
        throw new TimestampAdapterError("rootHash must be a sha256 digest");
      }
      const submittedAt = now();
      submissions.set(rootHash, { rootHash, submittedAt });
      return { rootHash, submittedAt };
    },
    async getProof(rootHash) {
      const submission = submissions.get(rootHash);
      if (!submission) return null;
      return { adapter: "local", rootHash: submission.rootHash, submittedAt: submission.submittedAt, proof: "local-timestamp-proof" };
    },
    _submissions: submissions,
  });
}

/** Persist one OTS proof next to its checkpoint (M12-23). */
export async function storeOtsProof({ repository, checkpointId, proof } = {}) {
  if (!repository || typeof repository.insertOtsProof !== "function") {
    throw new TimestampAdapterError("repository insertOtsProof is required", "OTS_STORE_UNAVAILABLE");
  }
  if (typeof checkpointId !== "string" || checkpointId.length === 0) throw new TimestampAdapterError("checkpointId is required");
  if (!proof || typeof proof.rootHash !== "string") throw new TimestampAdapterError("proof with rootHash is required");
  await repository.insertOtsProof({ checkpointId, ...proof });
  return { checkpointId, stored: true };
}
