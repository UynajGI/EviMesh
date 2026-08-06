import test from 'node:test';
import assert from 'node:assert/strict';
import { retryOutboxJob, OutboxRetryError } from '../src/outbox-retry.mjs';

test('records last_error and reschedules with exponential backoff', async () => {
  let received;
  const job = await retryOutboxJob({
    repository: {
      rescheduleOutboxJob: async (input) => {
        received = input;
        return { ...input, status: 'pending' };
      },
    },
    outboxId: 'outbox_1',
    attempts: 2,
    lastError: 'destination timed out',
    failedAt: '2026-08-06T02:00:00Z',
    baseDelayMs: 1_000,
    maxDelayMs: 10_000,
  });
  assert.deepEqual(received, {
    outboxId: 'outbox_1',
    attempts: 3,
    lastError: 'destination timed out',
    availableAt: '2026-08-06T02:00:04.000Z',
  });
  assert.equal(job.status, 'pending');
});

test('caps retry delay and rejects non-processing or malformed retries', async () => {
  let received;
  await retryOutboxJob({
    repository: { rescheduleOutboxJob: async (input) => { received = input; return { ...input, status: 'pending' }; } },
    outboxId: 'outbox_1', attempts: 10, lastError: 'retry', failedAt: '2026-08-06T02:00:00Z', baseDelayMs: 1_000, maxDelayMs: 5_000,
  });
  assert.equal(received.availableAt, '2026-08-06T02:00:05.000Z');
  await assert.rejects(
    retryOutboxJob({ repository: { rescheduleOutboxJob: async () => null }, outboxId: 'outbox_1', attempts: 0, lastError: 'retry', failedAt: '2026-08-06T02:00:00Z' }),
    (error) => error instanceof OutboxRetryError && error.code === 'OUTBOX_JOB_NOT_PROCESSING',
  );
  await assert.rejects(
    retryOutboxJob({ repository: {}, outboxId: 'outbox_1', attempts: -1, lastError: 'retry' }),
    /rescheduleOutboxJob is required/,
  );
  await assert.rejects(
    retryOutboxJob({ repository: { rescheduleOutboxJob: async () => null }, outboxId: 'outbox_1', attempts: -1, lastError: 'retry', failedAt: '2026-08-06T02:00:00Z' }),
    /attempts must be a non-negative integer/,
  );
});
