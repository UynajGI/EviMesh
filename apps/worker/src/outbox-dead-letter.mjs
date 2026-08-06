export class OutboxDeadLetterError extends Error {
  constructor(message, code = 'OUTBOX_DEAD_LETTER_INVALID', status = 400) {
    super(message);
    this.name = 'OutboxDeadLetterError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OutboxDeadLetterError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new OutboxDeadLetterError(`${field} must be a non-negative integer`);
  return value;
}

/** Stop automatic delivery once this failure reaches the configured maximum attempt count. */
export async function deadLetterOutboxJob({ repository, outboxId, attempts, maxAttempts, lastError } = {}) {
  if (!repository || typeof repository.markOutboxDeadLetter !== 'function') {
    throw new OutboxDeadLetterError('repository markOutboxDeadLetter is required');
  }
  outboxId = requiredText(outboxId, 'outbox id');
  lastError = requiredText(lastError, 'last error');
  attempts = nonNegativeInteger(attempts, 'attempts');
  maxAttempts = nonNegativeInteger(maxAttempts, 'max attempts');
  const nextAttempts = attempts + 1;
  if (nextAttempts < maxAttempts) {
    throw new OutboxDeadLetterError('outbox job has remaining retry attempts', 'OUTBOX_RETRY_REMAINING', 409);
  }
  const job = await repository.markOutboxDeadLetter({ outboxId, attempts: nextAttempts, lastError });
  if (!job) throw new OutboxDeadLetterError('outbox job was not processing', 'OUTBOX_JOB_NOT_PROCESSING', 409);
  if (job.outboxId !== outboxId || job.status !== 'dead_letter' || job.attempts !== nextAttempts || job.lastError !== lastError) {
    throw new OutboxDeadLetterError('dead-letter outbox job result is invalid', 'OUTBOX_DEAD_LETTER_RESULT_INVALID', 500);
  }
  return job;
}
