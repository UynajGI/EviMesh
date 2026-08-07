import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { buildClient } from "./client.mjs";
import { flagString, flagBool, requirePositional } from "./args.mjs";
import { readDocument, validateDocument, verificationDocToApi } from "./documents.mjs";
import { signSubmission, createNonce } from "./signing.mjs";
import { verifyContextBundleHash } from "../../protocol/src/context-bundle-hash.mjs";
import { verifyMerkleInclusionProof } from "../../merkle/src/verify-inclusion-proof.mjs";
import { verifyMerkleCheckpoint } from "../../signatures/src/merkle-checkpoint.mjs";
import { createObjectId } from "../../protocol/src/uuidv7.mjs";

/** Lock one ClaimRevision, prepare verification signing bytes, and fetch the Blind Context. */
export async function verifyCheckout({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const claimId = requirePositional(positionals, 0, "claimId");
  const revision = Number(requirePositional(positionals, 1, "revision"));
  const contractId = flagString(flags, "contract", flagString(flags, "contract-id", null));
  const contractRevision = Number(flagString(flags, "contract-revision", "1"));
  const detail = await client.claims.get(claimId);
  const lockedRevision = await client.claims.revision(claimId, revision);
  const checkout = {
    claimId,
    claimRevision: revision,
    etag: detail?.etag ?? null,
    lockedRevision,
    prepared: null,
    blindContext: null,
  };
  if (contractId) {
    const nonce = createNonce();
    checkout.prepared = await client.verifications.prepare({ claimId, claimRevision: revision, contractId, contractRevision, nonce });
  }
  const taskId = flagString(flags, "task", flagString(flags, "task-id", null));
  if (taskId) {
    const bundle = await client.tasks.context(taskId, "blind");
    if (typeof bundle?.contentHash === "string" && bundle.manifest !== undefined) {
      verifyContextBundleHash({ bundle: bundle.manifest, expectedHash: bundle.contentHash });
    }
    checkout.blindContext = bundle;
  }
  const out = resolve(flagString(flags, "out", `.evimesh/verification/${claimId}-${revision}.checkout.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(checkout, null, 2)}\n`, "utf8");
  output.emit({ json: flagBool(flags, "json") }, { claimId, claimRevision: revision, out, prepared: checkout.prepared !== null, blindContext: checkout.blindContext !== null }, (data) =>
    `checked out ${data.claimId}@${data.claimRevision}\nprepared: ${data.prepared}\nblind context: ${data.blindContext}\nwritten to ${data.out}`);
  return 0;
}

/** Sign and submit one VerificationReceipt document. */
export async function verifySubmit({ flags, output, positionals, env = process.env, fetchImpl } = {}) {
  const client = buildClient(flags, { env, fetchImpl });
  const path = requirePositional(positionals, 0, "file");
  const document = readDocument(path);
  validateDocument(document);
  if (document.schema !== "srp.verification-receipt.v1") throw new Error(`expected srp.verification-receipt.v1, got ${document.schema}`);
  const receiptId = flagString(flags, "receipt-id", createObjectId("Verification"));
  const runId = flagString(flags, "run", flagString(flags, "run-id", null));
  if (!runId) throw new Error("--run-id is required to submit a verification receipt");
  const contributionStatementId = flagString(flags, "statement-id", `statement_${randomUUID()}`);
  const body = verificationDocToApi(document, { receiptId, runId, contributionStatementId });
  const nonce = createNonce();
  const signed = await signSubmission({ eventType: "verification.submitted", payload: body, nonce }, { env });
  const envelope = {
    schema: "srp.client-signature-envelope.v1",
    event_type: "verification.submitted",
    payload: body,
    nonce,
    signing_bytes_hash: signed.signingBytesHash,
    signature: signed.signature,
  };
  if (flagBool(flags, "dry-run")) {
    output.emit({ json: flagBool(flags, "json") }, { dryRun: true, route: "/verifications", envelope }, (data) => `[dry-run] would POST ${data.route}\n${JSON.stringify(data.envelope, null, 2)}`);
    return 0;
  }
  const response = await client.verifications.submit({ ...body, signatureEnvelope: envelope });
  output.emit({ json: flagBool(flags, "json") }, { submitted: true, receiptId, envelope, response }, (data) => `submitted verification receipt ${data.receiptId}\nsigning hash: ${data.envelope.signing_bytes_hash}`);
  return 0;
}

/**
 * Offline-verify a bundle file. The bundle may carry any of:
 *   contextBundle { manifest, contentHash }, proofs [{ proof }], checkpoint, events.
 */
export async function bundleVerify({ flags, output, positionals }) {
  const path = requirePositional(positionals, 0, "file");
  const bundle = JSON.parse(readFileSync(path, "utf8"));
  const results = [];
  if (bundle.contextBundle?.contentHash && bundle.contextBundle.manifest !== undefined) {
    try {
      verifyContextBundleHash({ bundle: bundle.contextBundle.manifest, expectedHash: bundle.contextBundle.contentHash });
      results.push({ item: "contextBundle", verified: true });
    } catch (error) {
      results.push({ item: "contextBundle", verified: false, reason: error.message });
    }
  }
  for (const [index, entry] of (bundle.proofs ?? []).entries()) {
    results.push({ item: `proof[${index}]`, verified: verifyMerkleInclusionProof(entry.proof ?? entry) });
  }
  if (bundle.checkpoint) {
    const publicKey = flagString(flags, "platform-key", null);
    if (publicKey) {
      try {
        const ok = await verifyMerkleCheckpoint({ checkpoint: bundle.checkpoint, publicKey });
        results.push({ item: "checkpoint", verified: ok });
      } catch (error) {
        results.push({ item: "checkpoint", verified: false, reason: error.message });
      }
    } else {
      results.push({ item: "checkpoint", verified: false, reason: "no --platform-key provided; signature not checked" });
    }
  }
  const allVerified = results.length > 0 && results.every((result) => result.verified);
  output.emit({ json: flagBool(flags, "json") }, { valid: allVerified, results }, (data) =>
    data.results.map((result) => `${result.verified ? "ok" : "FAIL"} ${result.item}${result.reason ? ` (${result.reason})` : ""}`).join("\n"));
  return allVerified ? 0 : 1;
}
