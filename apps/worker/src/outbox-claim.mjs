export class OutboxClaimError extends Error {
  constructor(message, code = 'OUTBOX_CLAIM_INVALID', status = 400) {
    super(message);
    this.name = 'OutboxClaimError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OutboxClaimError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function claimOptions({ workerId, limit, now }) {
  workerId = requiredText(workerId, 'worker id');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new OutboxClaimError('limit must be an integer between 1 and 100');
  }
  if (typeof now !== 'string' || Number.isNaN(Date.parse(now))) {
    throw new OutboxClaimError('now must be an ISO-8601 timestamp');
  }
  return { workerId, limit, now: new Date(now).toISOString() };
}

function assertClaimedJobs(jobs) {
  if (!Array.isArray(jobs)) throw new OutboxClaimError('claimed outbox jobs must be an array', 'OUTBOX_CLAIM_RESULT_INVALID', 500);
  const outboxIds = jobs.map((job) => job?.outboxId);
  if (outboxIds.some((outboxId) => typeof outboxId !== 'string' || outboxId.length === 0) || new Set(outboxIds).size !== outboxIds.length) {
    throw new OutboxClaimError('claimed outbox jobs must have unique outbox ids', 'OUTBOX_CLAIM_RESULT_INVALID', 500);
  }
  if (jobs.some((job) => job.status !== 'processing' || typeof job.lockedAt !== 'string')) {
    throw new OutboxClaimError('claimed outbox jobs must be processing and locked', 'OUTBOX_CLAIM_RESULT_INVALID', 500);
  }
}

/** Claim due pending jobs atomically; repository must use a compare-and-set database operation. */
export async function claimOutboxJobs({ repository, workerId, limit = 10, now = new Date().toISOString() } = {}) {
  if (!repository || typeof repository.claimPendingOutboxJobs !== 'function') {
    throw new OutboxClaimError('repository claimPendingOutboxJobs is required');
  }
  const options = claimOptions({ workerId, limit, now });
  const jobs = await repository.claimPendingOutboxJobs(options);
  assertClaimedJobs(jobs);
  return jobs;
}
