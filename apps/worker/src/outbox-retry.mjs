export class OutboxRetryError extends Error {
  constructor(message, code = 'OUTBOX_RETRY_INVALID', status = 400) {
    super(message);
    this.name = 'OutboxRetryError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OutboxRetryError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function timestamp(value, field) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new OutboxRetryError(`${field} must be an ISO-8601 timestamp`);
  }
  return new Date(value).toISOString();
}

function delayMs({ attempts, baseDelayMs, maxDelayMs }) {
  if (!Number.isInteger(attempts) || attempts < 0) throw new OutboxRetryError('attempts must be a non-negative integer');
  if (!Number.isInteger(baseDelayMs) || baseDelayMs < 1) throw new OutboxRetryError('base delay must be a positive integer');
  if (!Number.isInteger(maxDelayMs) || maxDelayMs < baseDelayMs) throw new OutboxRetryError('max delay must be an integer at least as large as base delay');
  return Math.min(baseDelayMs * (2 ** attempts), maxDelayMs);
}

/** Record a worker failure and reschedule a processing job with bounded exponential backoff. */
export async function retryOutboxJob({
  repository,
  outboxId,
  attempts,
  lastError,
  failedAt = new Date().toISOString(),
  baseDelayMs = 1_000,
  maxDelayMs = 3_600_000,
} = {}) {
  if (!repository || typeof repository.rescheduleOutboxJob !== 'function') {
    throw new OutboxRetryError('repository rescheduleOutboxJob is required');
  }
  outboxId = requiredText(outboxId, 'outbox id');
  lastError = requiredText(lastError, 'last error');
  failedAt = timestamp(failedAt, 'failed at');
  const nextAttempts = attempts + 1;
  const availableAt = new Date(Date.parse(failedAt) + delayMs({ attempts, baseDelayMs, maxDelayMs })).toISOString();
  const job = await repository.rescheduleOutboxJob({ outboxId, attempts: nextAttempts, lastError, availableAt });
  if (!job) throw new OutboxRetryError('outbox job was not processing', 'OUTBOX_JOB_NOT_PROCESSING', 409);
  if (job.outboxId !== outboxId || job.status !== 'pending' || job.attempts !== nextAttempts || job.lastError !== lastError || job.availableAt !== availableAt) {
    throw new OutboxRetryError('retried outbox job result is invalid', 'OUTBOX_RETRY_RESULT_INVALID', 500);
  }
  return job;
}
