import test from 'node:test';
import assert from 'node:assert/strict';
import { deadLetterOutboxJob, OutboxDeadLetterError } from '../src/outbox-dead-letter.mjs';

test('stops automatic retries by marking the maximum-attempt job dead_letter', async () => {
  let received;
  const job = await deadLetterOutboxJob({
    repository: {
      markOutboxDeadLetter: async (input) => {
        received = input;
        return { ...input, status: 'dead_letter' };
      },
    },
    outboxId: 'outbox_1', attempts: 2, maxAttempts: 3, lastError: 'destination unavailable',
  });
  assert.deepEqual(received, { outboxId: 'outbox_1', attempts: 3, lastError: 'destination unavailable' });
  assert.equal(job.status, 'dead_letter');
});

test('does not dead-letter a job with retries remaining and rejects stale completion', async () => {
  let called = false;
  await assert.rejects(
    deadLetterOutboxJob({ repository: { markOutboxDeadLetter: async () => { called = true; return null; } }, outboxId: 'outbox_1', attempts: 1, maxAttempts: 3, lastError: 'retryable' }),
    (error) => error instanceof OutboxDeadLetterError && error.code === 'OUTBOX_RETRY_REMAINING',
  );
  assert.equal(called, false);
  await assert.rejects(
    deadLetterOutboxJob({ repository: { markOutboxDeadLetter: async () => null }, outboxId: 'outbox_1', attempts: 2, maxAttempts: 3, lastError: 'final' }),
    (error) => error.code === 'OUTBOX_JOB_NOT_PROCESSING',
  );
});
