import { randomUUID } from "node:crypto";
import { MirrorError } from "./github-release.mjs";

/**
 * Record one mirror receipt (M12-19): release URL, asset hash, and time.
 */
export async function recordMirrorReceipt({ repository, frontierSnapshotId, releaseUrl, assetSha256, sizeBytes, mirroredAt = new Date() } = {}) {
  if (!repository || typeof repository.insertMirrorReceipt !== "function") {
    throw new MirrorError("repository insertMirrorReceipt is required", "MIRROR_RECEIPT_UNAVAILABLE");
  }
  if (typeof frontierSnapshotId !== "string" || frontierSnapshotId.length === 0) throw new MirrorError("frontierSnapshotId is required");
  if (typeof releaseUrl !== "string" || releaseUrl.length === 0) throw new MirrorError("releaseUrl is required");
  if (typeof assetSha256 !== "string" || !/^[0-9a-f]{64}$/.test(assetSha256)) throw new MirrorError("assetSha256 must be a sha256 hex digest");
  const receipt = {
    mirrorReceiptId: `mirror-receipt_${randomUUID()}`,
    frontierSnapshotId,
    provider: "github-release",
    releaseUrl,
    assetSha256,
    sizeBytes: sizeBytes ?? null,
    mirroredAt,
  };
  await repository.insertMirrorReceipt(receipt);
  return receipt;
}

/**
 * Mirror one frontier bundle ZIP to GitHub Releases (M12-17/18) and store the
 * receipt (M12-19). On failure the job is queued for Outbox retry (M12-20).
 */
export async function mirrorFrontierBundle({ client, repository, snapshot, zipBytes, fileName, enqueueRetry = null } = {}) {
  if (!client || typeof client.createRelease !== "function" || typeof client.uploadAsset !== "function") {
    throw new MirrorError("mirror client is required");
  }
  if (!(zipBytes instanceof Uint8Array) || zipBytes.length === 0) throw new MirrorError("zipBytes is required");
  const tag = `frontier/${snapshot.projectId}/${snapshot.sequence}`;
  try {
    const release = await client.createRelease({ tag, name: `Frontier ${snapshot.projectId} #${snapshot.sequence}` });
    const asset = await client.uploadAsset({ releaseId: release.releaseId, fileName, bytes: zipBytes });
    const receipt = await recordMirrorReceipt({
      repository,
      frontierSnapshotId: snapshot.snapshotId,
      releaseUrl: asset.url ?? release.url,
      assetSha256: asset.sha256,
      sizeBytes: asset.sizeBytes,
    });
    return Object.freeze({ mirrored: true, releaseUrl: release.url, assetUrl: asset.url, receipt });
  } catch (error) {
    if (typeof enqueueRetry === "function") {
      await enqueueRetry({
        jobType: "mirror.frontier-release",
        payload: { frontierSnapshotId: snapshot.snapshotId, tag, fileName, error: error.message },
      });
      return Object.freeze({ mirrored: false, queuedForRetry: true, error: error.message });
    }
    throw error;
  }
}

/**
 * Secondary mirror adapter registry (M12-21). Any provider that implements
 * `{ name, publish({ snapshot, zipBytes, fileName }) }` can be registered.
 */
export function createMirrorAdapterRegistry() {
  const adapters = new Map();
  return Object.freeze({
    register(adapter) {
      if (!adapter || typeof adapter.name !== "string" || adapter.name.length === 0) throw new MirrorError("adapter name is required");
      if (typeof adapter.publish !== "function") throw new MirrorError("adapter publish is required");
      if (adapters.has(adapter.name)) throw new MirrorError(`adapter already registered: ${adapter.name}`);
      adapters.set(adapter.name, adapter);
    },
    names() {
      return [...adapters.keys()];
    },
    async publishAll({ snapshot, zipBytes, fileName }) {
      const results = [];
      for (const [name, adapter] of adapters) {
        try {
          const result = await adapter.publish({ snapshot, zipBytes, fileName });
          results.push({ name, ok: true, result });
        } catch (error) {
          results.push({ name, ok: false, error: error.message });
        }
      }
      return results;
    },
  });
}
