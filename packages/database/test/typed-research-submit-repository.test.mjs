import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TypedResearchSubmitRepositoryError,
  createTypedResearchSubmitRepository,
} from '../src/typed-research-submit.mjs';

function sqlFixture({ result = { schema: 'evimesh.typed-research-submit-result.v1' }, error = null } = {}) {
  const calls = [];
  const transaction = {
    async unsafe(statement, values = []) {
      calls.push([statement, values]);
      if (error && statement.startsWith('SELECT public.execute')) throw error;
      if (statement.startsWith('SELECT current_role')) return [{ currentRole: 'service_role' }];
      if (statement.startsWith('SELECT public.execute')) return [{ result }];
      return [];
    },
  };
  const sql = Object.assign(() => {}, {
    begin: async (callback) => callback(transaction),
  });
  return { sql, calls };
}

const input = {
  agentActorId: 'agent-1',
  signatureEnvelope: { schema: 'srp.client-signature-envelope.v1' },
  platformEvent: { eventId: '018f0f4a-5c00-7000-8000-000000000001' },
};

test('adapter assumes service_role locally and calls only the fixed three-argument RPC', async () => {
  const { sql, calls } = sqlFixture({ result: { receiptId: 'receipt-1' } });
  const repository = createTypedResearchSubmitRepository(sql);
  assert.deepEqual(await repository.executeTypedResearchSubmit(input), { receiptId: 'receipt-1' });
  assert.deepEqual(calls.map(([statement]) => statement), [
    'SET LOCAL ROLE service_role',
    'SELECT current_role::text AS "currentRole"',
    'SELECT public.execute_typed_research_submit($1::text,$2::jsonb,$3::jsonb) AS result',
  ]);
  assert.deepEqual(calls[2][1], [input.agentActorId, input.signatureEnvelope, input.platformEvent]);
});

test('adapter maps stable PostgreSQL bracket codes without leaking a generic mutation surface', async () => {
  const { sql } = sqlFixture({ error: new Error('[TYPED_RESEARCH_REPLAY_CONFLICT] nonce differs') });
  const repository = createTypedResearchSubmitRepository(sql);
  await assert.rejects(
    repository.executeTypedResearchSubmit(input),
    (error) => error instanceof TypedResearchSubmitRepositoryError
      && error.code === 'TYPED_RESEARCH_REPLAY_CONFLICT'
      && error.status === 409,
  );
  assert.equal('upsertNode' in repository, false);
  assert.equal('addEdge' in repository, false);
});

test('adapter preserves a conflicting immutable platform event as HTTP conflict', async () => {
  const { sql } = sqlFixture({
    error: new Error('[RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT] immutable event differs'),
  });
  const repository = createTypedResearchSubmitRepository(sql);
  await assert.rejects(
    repository.executeTypedResearchSubmit(input),
    (error) => error instanceof TypedResearchSubmitRepositoryError
      && error.code === 'RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT'
      && error.status === 409,
  );
});

test('adapter maps project closure and missing immutable sources intentionally', async () => {
  for (const [message, code, status] of [
    ['[TYPED_RESEARCH_PROJECT_INVALID] project is inactive', 'TYPED_RESEARCH_PROJECT_INVALID', 403],
    ['[TYPED_RESEARCH_DANGLING_SOURCE] exact source is absent', 'TYPED_RESEARCH_DANGLING_SOURCE', 409],
  ]) {
    const { sql } = sqlFixture({ error: new Error(message) });
    const repository = createTypedResearchSubmitRepository(sql);
    await assert.rejects(
      repository.executeTypedResearchSubmit(input),
      (error) => error.code === code && error.status === status,
    );
  }
});

test('adapter rejects missing attribution or envelope before opening a transaction', async () => {
  const { sql, calls } = sqlFixture();
  const repository = createTypedResearchSubmitRepository(sql);
  await assert.rejects(
    repository.executeTypedResearchSubmit({ ...input, agentActorId: ' agent-1' }),
    (error) => error.code === 'TYPED_RESEARCH_SUBMIT_INPUT_INVALID' && error.status === 400,
  );
  await assert.rejects(
    repository.executeTypedResearchSubmit({ ...input, signatureEnvelope: null }),
    (error) => error.code === 'TYPED_RESEARCH_SUBMIT_INPUT_INVALID',
  );
  assert.equal(calls.length, 0);
});
