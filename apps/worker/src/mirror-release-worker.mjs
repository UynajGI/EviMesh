import { exportFrontierBundle } from '../../../packages/frontier-bundle/src/exporter.mjs';
import { mirrorFrontierBundle } from '../../../packages/frontier-bundle/src/mirror.mjs';
import { acknowledgeOutboxJob } from './outbox-ack.mjs';
import { retryOutboxJob } from './outbox-retry.mjs';
import { deadLetterOutboxJob } from './outbox-dead-letter.mjs';

export class MirrorReleaseError extends Error {
  constructor(message, code = 'MIRROR_RELEASE_INVALID', status = 400) {
    super(message);
    this.name = 'MirrorReleaseError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MirrorReleaseError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

/** Resolve the published Frontier snapshot referenced by one outbox event. */
export async function resolveFrontierSnapshotForEvent({ repository, eventId } = {}) {
  if (!repository || typeof repository.getResearchEvent !== 'function' || typeof repository.getFrontierSnapshot !== 'function') {
    throw new MirrorReleaseError('repository getResearchEvent and getFrontierSnapshot are required', 'MIRROR_RELEASE_REPOSITORY_INVALID');
  }
  eventId = requiredText(eventId, 'event id');
  const event = await repository.getResearchEvent(eventId);
  if (!event) throw new MirrorReleaseError('research event not found', 'MIRROR_RELEASE_EVENT_NOT_FOUND', 404);
  const snapshotId = event.payload?.snapshot_id ?? event.payload?.snapshotId;
  if (typeof snapshotId !== 'string' || snapshotId.trim().length === 0) {
    throw new MirrorReleaseError('event does not reference a frontier snapshot', 'MIRROR_RELEASE_EVENT_INVALID', 409);
  }
  const snapshot = await repository.getFrontierSnapshot(snapshotId);
  if (!snapshot) throw new MirrorReleaseError('frontier snapshot not found', 'MIRROR_RELEASE_SNAPSHOT_NOT_FOUND', 404);
  return snapshot;
}

/**
 * Process one frontier-mirror outbox job (M12-17/18/20): export the published
 * Frontier as a ZIP bundle and mirror it to GitHub Releases. Success
 * acknowledges the job; failure reschedules it with bounded exponential
 * backoff, and repeated failure dead-letters it.
 */
export async function processFrontierMirrorJob({
  repository,
  outboxId,
  eventId,
  attempts,
  mirrorClient,
  maxAttempts = 10,
  now = new Date(),
} = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') {
    throw new MirrorReleaseError('repository withTransaction is required', 'MIRROR_RELEASE_REPOSITORY_INVALID');
  }
  if (!mirrorClient || typeof mirrorClient.createRelease !== 'function' || typeof mirrorClient.uploadAsset !== 'function') {
    throw new MirrorReleaseError('mirror client is required', 'MIRROR_RELEASE_CLIENT_INVALID');
  }
  outboxId = requiredText(outboxId, 'outbox id');
  eventId = requiredText(eventId, 'event id');
  if (!Number.isInteger(attempts) || attempts < 0) throw new MirrorReleaseError('attempts must be a non-negative integer');

  let snapshotId = null;
  try {
    // Resolution lives inside the guarded block so a missing event, malformed
    // payload, or vanished snapshot is retried / dead-lettered rather than
    // leaving the claimed job stuck in processing.
    const snapshot = await resolveFrontierSnapshotForEvent({ repository, eventId });
    snapshotId = snapshot.snapshotId;
    const fileName = `${snapshotId}.zip`;
    const { zip } = await exportFrontierBundle({ repository, snapshotId, zip: true, createdAt: now.toISOString() });
    const result = await mirrorFrontierBundle({ client: mirrorClient, repository, snapshot, zipBytes: zip, fileName });
    await acknowledgeOutboxJob({ repository, outboxId, processedAt: now.toISOString() });
    return Object.freeze({ mirrored: true, outboxId, snapshotId, releaseUrl: result.releaseUrl, assetUrl: result.assetUrl });
  } catch (error) {
    const nextAttempts = attempts + 1;
    const lastError = error?.message ?? String(error);
    if (nextAttempts >= maxAttempts) {
      await deadLetterOutboxJob({ repository, outboxId, attempts, maxAttempts, lastError });
      return Object.freeze({ mirrored: false, outboxId, snapshotId, deadLettered: true, error: lastError });
    }
    await retryOutboxJob({ repository, outboxId, attempts, lastError, failedAt: now.toISOString() });
    return Object.freeze({ mirrored: false, outboxId, snapshotId, retryScheduled: true, attempts: nextAttempts, error: lastError });
  }
}
