export class OutboxAckError extends Error {
  constructor(message, code = 'OUTBOX_ACK_INVALID', status = 400) {
    super(message);
    this.name = 'OutboxAckError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OutboxAckError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function processedTimestamp(value) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new OutboxAckError('processed at must be an ISO-8601 timestamp');
  }
  return new Date(value).toISOString();
}

/** Confirm a successfully completed claimed job; repository must only update a processing row. */
export async function acknowledgeOutboxJob({ repository, outboxId, processedAt = new Date().toISOString() } = {}) {
  if (!repository || typeof repository.markOutboxProcessed !== 'function') {
    throw new OutboxAckError('repository markOutboxProcessed is required');
  }
  outboxId = requiredText(outboxId, 'outbox id');
  processedAt = processedTimestamp(processedAt);
  const job = await repository.markOutboxProcessed({ outboxId, processedAt });
  if (!job) throw new OutboxAckError('outbox job was not processing', 'OUTBOX_JOB_NOT_PROCESSING', 409);
  if (job.outboxId !== outboxId || job.status !== 'processed' || job.processedAt !== processedAt) {
    throw new OutboxAckError('processed outbox job result is invalid', 'OUTBOX_ACK_RESULT_INVALID', 500);
  }
  return job;
}
