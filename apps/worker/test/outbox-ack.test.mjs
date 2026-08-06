import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeOutboxJob, OutboxAckError } from '../src/outbox-ack.mjs';

test('marks a completed processing job as processed with processedAt', async () => {
  let received;
  const job = await acknowledgeOutboxJob({
    repository: {
      markOutboxProcessed: async (input) => {
        received = input;
        return { ...input, status: 'processed' };
      },
    },
    outboxId: 'outbox_1',
    processedAt: '2026-08-06T02:00:00Z',
  });
  assert.deepEqual(received, { outboxId: 'outbox_1', processedAt: '2026-08-06T02:00:00.000Z' });
  assert.deepEqual(job, { outboxId: 'outbox_1', processedAt: '2026-08-06T02:00:00.000Z', status: 'processed' });
});

test('rejects acknowledgement of a job that was not processing or has an invalid result', async () => {
  await assert.rejects(
    acknowledgeOutboxJob({ repository: { markOutboxProcessed: async () => null }, outboxId: 'outbox_1', processedAt: '2026-08-06T02:00:00Z' }),
    (error) => error instanceof OutboxAckError && error.code === 'OUTBOX_JOB_NOT_PROCESSING',
  );
  await assert.rejects(
    acknowledgeOutboxJob({ repository: { markOutboxProcessed: async () => ({ outboxId: 'outbox_1', status: 'pending', processedAt: null }) }, outboxId: 'outbox_1', processedAt: '2026-08-06T02:00:00Z' }),
    (error) => error.code === 'OUTBOX_ACK_RESULT_INVALID',
  );
  await assert.rejects(
    acknowledgeOutboxJob({ repository: {}, outboxId: 'outbox_1' }),
    /markOutboxProcessed is required/,
  );
});
