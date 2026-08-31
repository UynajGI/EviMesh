import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildClient } from "./client.mjs";
import { flagString, flagBool, requirePositional } from "./args.mjs";
import { readDocument, validateDocument } from "./documents.mjs";
import { createNonce } from "./signing.mjs";
import { verifyContextBundleHash } from "../../protocol/src/context-bundle-hash.mjs";
import { verifyMerkleInclusionProof } from "../../merkle/src/verify-inclusion-proof.mjs";
import { buildMerkleTree } from "../../merkle/src/merkle-tree.mjs";
import { hashResearchEventLeaf } from "../../merkle/src/research-event-leaf.mjs";
import { verifyMerkleCheckpoint } from "../../signatures/src/merkle-checkpoint.mjs";

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

/** Legacy combined publishing is fail-closed; signing is an explicit local step. */
export async function verifySubmit({ flags, positionals } = {}) {
  const path = requirePositional(positionals, 0, "file");
  const document = readDocument(path);
  validateDocument(document);
  if (document.schema !== "srp.verification-receipt.v1") throw new Error(`expected srp.verification-receipt.v1, got ${document.schema}`);
  const runId = flagString(flags, "run", flagString(flags, "run-id", null));
  if (!runId) throw new Error("--run-id is required to submit a verification receipt");
  const error = new Error("sq verify submit no longer signs and submits in one step; use prepare -> the explicit human-local sign step -> submit with an existing envelope");
  error.code = "CLI_EXTERNAL_SIGNATURE_FLOW_REQUIRED";
  throw error;
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
  // Verify the checkpoint first so every proof can be bound to its signed root.
  let checkpointRoot = null;
  let checkpointVerified = false;
  if (bundle.checkpoint) {
    const publicKey = flagString(flags, "platform-key", null);
    if (!publicKey) {
      results.push({ item: "checkpoint", verified: false, reason: "no --platform-key provided; signature not checked" });
    } else {
      try {
        checkpointVerified = (await verifyMerkleCheckpoint({ checkpoint: bundle.checkpoint, publicKey })) === true;
        results.push({ item: "checkpoint", verified: checkpointVerified, reason: checkpointVerified ? undefined : "checkpoint signature did not verify" });
        if (checkpointVerified) checkpointRoot = bundle.checkpoint.rootHash;
      } catch (error) {
        results.push({ item: "checkpoint", verified: false, reason: error.message });
      }
    }
  }
  if (checkpointVerified && Array.isArray(bundle.events) && bundle.events.length > 0) {
    try {
      const leafHashes = bundle.events.map((event) => hashResearchEventLeaf(event.schema === "srp.event.v1" ? event : {
        schema: "srp.event.v1",
        event_id: event.eventId ?? event.event_id,
        event_type: event.eventType ?? event.event_type,
        payload: event.payload,
        hash: event.hash,
        signature: event.signature,
        parents: event.parents ?? [],
      }));
      const reconstructed = buildMerkleTree(leafHashes).root;
      const eventsMatch = reconstructed === checkpointRoot;
      results.push({ item: "events", verified: eventsMatch, reason: eventsMatch ? undefined : "event leaves do not reconstruct the checkpoint root" });
    } catch (error) {
      results.push({ item: "events", verified: false, reason: error.message });
    }
  }
  for (const [index, entry] of (bundle.proofs ?? []).entries()) {
    const proof = entry.proof ?? entry;
    if (!verifyMerkleInclusionProof(proof)) {
      results.push({ item: `proof[${index}]`, verified: false, reason: "proof does not reconstruct its own root" });
      continue;
    }
    if (bundle.checkpoint) {
      // A proof only counts when its root is the verified checkpoint root; a
      // self-consistent proof next to an unrelated checkpoint is a forgery.
      const bound = checkpointVerified && proof.root === checkpointRoot;
      results.push({ item: `proof[${index}]`, verified: bound, reason: bound ? undefined : checkpointVerified ? "proof root is not covered by the verified checkpoint" : "checkpoint did not verify; proof cannot be bound" });
    } else {
      results.push({ item: `proof[${index}]`, verified: true, reason: "self-consistent only (no checkpoint to bind against)" });
    }
  }
  const allVerified = results.length > 0 && results.every((result) => result.verified);
  output.emit({ json: flagBool(flags, "json") }, { valid: allVerified, results }, (data) =>
    data.results.map((result) => `${result.verified ? "ok" : "FAIL"} ${result.item}${result.reason ? ` (${result.reason})` : ""}`).join("\n"));
  return allVerified ? 0 : 1;
}
