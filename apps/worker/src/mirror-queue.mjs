import { claimOutboxJobs } from "./outbox-claim.mjs";
import { processFrontierMirrorJob } from "./mirror-release-worker.mjs";
import { createGitHubMirrorClient } from "../../../packages/frontier-bundle/src/github-release.mjs";

export const FRONTIER_PUBLISHED_EVENT_TYPE = "frontier.published";

export class MirrorQueueError extends Error {
  constructor(message, code = "MIRROR_QUEUE_INVALID") {
    super(message);
    this.name = "MirrorQueueError";
    this.code = code;
  }
}

/**
 * Build the GitHub mirror client from runtime configuration (Wrangler
 * vars/secret). Returns null when the token is not configured so callers can
 * skip mirroring instead of failing.
 */
export function buildMirrorClientFromEnv(env) {
  const token = env?.GITHUB_MIRROR_TOKEN;
  if (typeof token !== "string" || token.length === 0) return null;
  return createGitHubMirrorClient({
    token,
    owner: env?.GITHUB_MIRROR_OWNER ?? "UynajGI",
    repo: env?.GITHUB_MIRROR_REPO ?? "EviMesh-frontiers",
  });
}

/**
 * One queue pass (M12-20 wiring): claim due outbox jobs and mirror every
 * `frontier.published` job. Non-frontier jobs are requeued so they are not
 * lost; a future type-aware claim should replace this filter.
 */
export async function runMirrorQueuePass({
  repository,
  mirrorClient = null,
  workerId,
  limit = 10,
  maxAttempts = 10,
  now = new Date(),
} = {}) {
  if (!repository || typeof repository.claimPendingOutboxJobs !== "function") {
    throw new MirrorQueueError("repository claimPendingOutboxJobs is required");
  }
  const client = mirrorClient ?? buildMirrorClientFromEnv(repository.env ?? {});
  const jobs = await claimOutboxJobs({ repository, workerId, limit, now: now.toISOString() });

  const results = [];
  for (const job of jobs) {
    const event = typeof repository.getResearchEvent === "function" ? await repository.getResearchEvent(job.eventId) : null;
    const eventType = event?.eventType ?? event?.event_type;
    if (event && eventType !== FRONTIER_PUBLISHED_EVENT_TYPE) {
      // A genuinely non-frontier event: requeue so the owning processor can
      // still run it. A MISSING event is not requeued here; it falls through
      // to processFrontierMirrorJob, whose guarded resolution retries it with
      // bounded backoff and eventually dead-letters it.
      await repository.rescheduleOutboxJob?.({ outboxId: job.outboxId, attempts: job.attempts, lastError: job.lastError ?? null, availableAt: now.toISOString() });
      results.push({ outboxId: job.outboxId, skipped: true });
      continue;
    }
    if (!client) {
      await repository.rescheduleOutboxJob?.({ outboxId: job.outboxId, attempts: job.attempts, lastError: "mirror client not configured", availableAt: now.toISOString() });
      results.push({ outboxId: job.outboxId, skipped: true, reason: "mirror client not configured" });
      continue;
    }
    const result = await processFrontierMirrorJob({
      repository,
      outboxId: job.outboxId,
      eventId: job.eventId,
      attempts: job.attempts,
      mirrorClient: client,
      maxAttempts,
      now,
    });
    results.push(result);
  }
  return Object.freeze({ processed: results.length, results });
}
