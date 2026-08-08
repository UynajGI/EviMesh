import { canonicalJson } from "../../protocol/src/hash.mjs";
import { signEd25519Payload } from "../../signatures/src/client-signature.mjs";
import { verifyEd25519Payload } from "../../signatures/src/server-verification.mjs";

export const WITNESS_CHECKPOINT_SCHEMA = "evimesh.witness-checkpoint.v1";

export class WitnessError extends Error {
  constructor(message, code = "WITNESS_INVALID") {
    super(message);
    this.name = "WitnessError";
    this.code = code;
  }
}

/**
 * Witness checkpoint format (M12-24): a third party signs the SAME Merkle
 * root the platform published, producing an independently verifiable receipt.
 */
export function witnessSigningBytes({ checkpointId, rootHash, witnessId, signedAt }) {
  if (typeof checkpointId !== "string" || checkpointId.length === 0) throw new WitnessError("checkpointId is required");
  if (typeof rootHash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(rootHash)) throw new WitnessError("rootHash must be a sha256 digest");
  if (typeof witnessId !== "string" || witnessId.length === 0) throw new WitnessError("witnessId is required");
  if (typeof signedAt !== "string" || Number.isNaN(Date.parse(signedAt))) throw new WitnessError("signedAt must be an ISO date");
  return new TextEncoder().encode(canonicalJson({
    schema: WITNESS_CHECKPOINT_SCHEMA,
    checkpoint_id: checkpointId,
    root_hash: rootHash,
    witness_id: witnessId,
    signed_at: signedAt,
  }));
}

export async function signWitnessCheckpoint({ checkpointId, rootHash, witnessId, keyId, privateKey, signedAt = new Date().toISOString() } = {}) {
  const signingBytes = witnessSigningBytes({ checkpointId, rootHash, witnessId, signedAt });
  const signature = await signEd25519Payload({ signingBytes, privateKey });
  return Object.freeze({
    schema: WITNESS_CHECKPOINT_SCHEMA,
    checkpointId,
    rootHash,
    witnessId,
    signedAt,
    signature: Object.freeze({ algorithm: "Ed25519", key_id: keyId, value: signature }),
  });
}

export async function verifyWitnessCheckpoint(receipt, { publicKey } = {}) {
  if (!receipt || receipt.schema !== WITNESS_CHECKPOINT_SCHEMA) throw new WitnessError("receipt schema must be evimesh.witness-checkpoint.v1");
  const signingBytes = witnessSigningBytes({ checkpointId: receipt.checkpointId, rootHash: receipt.rootHash, witnessId: receipt.witnessId, signedAt: receipt.signedAt });
  if (!receipt.signature || receipt.signature.algorithm !== "Ed25519" || typeof receipt.signature.value !== "string") {
    throw new WitnessError("receipt signature block is invalid");
  }
  return (await verifyEd25519Payload({ signingBytes, signature: receipt.signature.value, publicKey })) === true;
}

/**
 * Import one third-party witness receipt (M12-25). The receipt is only stored
 * when it signs the SAME root as the stored checkpoint and its Ed25519
 * signature verifies under the supplied witness public key.
 */
export async function importWitnessReceipt({ repository, receipt, publicKey, witnessReceiptId, now = new Date() } = {}) {
  if (!repository || typeof repository.getMerkleCheckpoint !== "function" || typeof repository.insertWitnessReceipt !== "function") {
    throw new WitnessError("repository getMerkleCheckpoint and insertWitnessReceipt are required", "WITNESS_IMPORT_UNAVAILABLE");
  }
  if (!receipt || receipt.schema !== WITNESS_CHECKPOINT_SCHEMA) {
    throw new WitnessError("receipt schema must be evimesh.witness-checkpoint.v1");
  }
  if (typeof publicKey !== "string" || publicKey.length === 0) {
    throw new WitnessError("witness public key is required");
  }
  const checkpoint = await repository.getMerkleCheckpoint(receipt.checkpointId);
  if (!checkpoint) throw new WitnessError("checkpoint not found", "WITNESS_CHECKPOINT_NOT_FOUND");
  if (checkpoint.rootHash !== receipt.rootHash) {
    throw new WitnessError("receipt root does not match checkpoint root", "WITNESS_ROOT_MISMATCH");
  }
  const valid = await verifyWitnessCheckpoint(receipt, { publicKey });
  if (!valid) throw new WitnessError("witness signature did not verify", "WITNESS_SIGNATURE_INVALID");
  const stored = {
    witnessReceiptId: witnessReceiptId ?? `witness-receipt_${receipt.checkpointId}_${receipt.witnessId}`,
    checkpointId: receipt.checkpointId,
    witnessId: receipt.witnessId,
    publicKey,
    signature: receipt.signature.value,
    signedAt: receipt.signedAt,
    receivedAt: now,
  };
  await repository.insertWitnessReceipt(stored);
  return stored;
}
