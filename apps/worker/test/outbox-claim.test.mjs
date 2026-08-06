import test from 'node:test';
import assert from 'node:assert/strict';
import { claimOutboxJobs, OutboxClaimError } from '../src/outbox-claim.mjs';

function atomicRepository(initialJobs) {
  const jobs = initialJobs.map((job) => ({ ...job }));
  return {
    claimPendingOutboxJobs: async ({ limit, now }) => {
      const claimed = jobs.filter((job) => job.status === 'pending' && job.availableAt <= now).slice(0, limit);
      for (const job of claimed) Object.assign(job, { status: 'processing', lockedAt: now });
      return claimed.map((job) => ({ ...job }));
    },
  };
}

test('concurrent Workers cannot claim the same pending outbox job', async () => {
  const repository = atomicRepository([
    { outboxId: 'outbox_1', status: 'pending', availableAt: '2026-08-06T00:00:00.000Z' },
  ]);
  const options = { repository, limit: 1, now: '2026-08-06T01:00:00Z' };
  const [first, second] = await Promise.all([
    claimOutboxJobs({ ...options, workerId: 'worker_a' }),
    claimOutboxJobs({ ...options, workerId: 'worker_b' }),
  ]);
  assert.equal(first.length + second.length, 1);
  assert.equal([...first, ...second][0].outboxId, 'outbox_1');
  assert.equal([...first, ...second][0].status, 'processing');
});

test('validates claim input and rejects a non-atomic repository result', async () => {
  await assert.rejects(
    claimOutboxJobs({ repository: {}, workerId: 'worker_a' }),
    /claimPendingOutboxJobs is required/,
  );
  await assert.rejects(
    claimOutboxJobs({ repository: atomicRepository([]), workerId: ' ', now: '2026-08-06T00:00:00Z' }),
    /worker id/,
  );
  await assert.rejects(
    claimOutboxJobs({ repository: { claimPendingOutboxJobs: async () => [{ outboxId: 'outbox_1', status: 'pending' }] }, workerId: 'worker_a', now: '2026-08-06T00:00:00Z' }),
    (error) => error instanceof OutboxClaimError && error.code === 'OUTBOX_CLAIM_RESULT_INVALID',
  );
});
