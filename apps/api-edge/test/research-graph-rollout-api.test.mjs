import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiResearchGraphRollout, createResearchGraphRolloutFromEnv } from '../src/research-graph-rollout-api.mjs';
import { createClaim } from '../../../packages/domain/src/claim-command.mjs';

function claimGraph(id) {
  return {
    rootClaimId: 'claim-root',
    maxDepth: 1,
    nodes: [{ claimId: id, depth: 1 }],
    edges: [{ sourceClaimId: id, targetClaimId: 'claim-root', relationType: 'supports' }],
    truncated: false,
  };
}

test('shadow compatibility keeps legacy authoritative and emits internal parity telemetry', async () => {
  const reports = [];
  const rollout = createApiResearchGraphRollout({
    readMode: 'shadow',
    writeMode: 'legacy',
    onParity: async (report) => reports.push(report),
  });
  const legacy = claimGraph('claim-legacy');
  const value = await rollout.readCompatibility({
    surface: 'claim_graph',
    identity: 'claim-root:downstream',
    readLegacy: async () => legacy,
    readKernel: async () => claimGraph('claim-kernel'),
  });
  assert.equal(value, legacy);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].event, 'research_graph.parity');
  assert.equal(reports[0].surface, 'claim_graph');
  assert.equal(reports[0].matches, false);
  assert.deepEqual(reports[0].missingKernelNodes, ['claim:claim-legacy@1']);
});

test('shadow kernel failures are telemetry-only while kernel cutover fails closed', async () => {
  const reports = [];
  const shadow = createApiResearchGraphRollout({ readMode: 'shadow', onParity: async (report) => reports.push(report) });
  const legacy = claimGraph('claim-legacy');
  assert.equal(await shadow.readCompatibility({
    surface: 'claim_graph', identity: 'claim-root', readLegacy: async () => legacy, readKernel: async () => { throw new Error('kernel offline'); },
  }), legacy);
  assert.equal(reports[0].matches, false);
  assert.equal(reports[0].shadowError, 'kernel offline');

  const kernel = createApiResearchGraphRollout({ readMode: 'kernel', writeMode: 'kernel' });
  await assert.rejects(
    kernel.readCompatibility({ surface: 'claim_graph', identity: 'claim-root', readKernel: async () => claimGraph('claim-kernel') }),
    (error) => error.code === 'RESEARCH_GRAPH_CUTOVER_BLOCKED' && error.status === 409,
  );
});

test('typed entities are explicitly kernel-only and require the cutover gate', () => {
  assert.throws(() => createApiResearchGraphRollout({ writeMode: 'legacy' }).assertTypedKernelWrite(), (error) => error.code === 'TYPED_RESEARCH_KERNEL_CUTOVER_REQUIRED');
  assert.throws(() => createApiResearchGraphRollout({ writeMode: 'dual_write' }).assertTypedKernelWrite(), (error) => error.code === 'TYPED_RESEARCH_KERNEL_CUTOVER_REQUIRED');
  assert.throws(() => createApiResearchGraphRollout({ writeMode: 'kernel' }).assertTypedKernelWrite(), (error) => error.code === 'RESEARCH_GRAPH_CUTOVER_BLOCKED');
  assert.equal(createApiResearchGraphRollout({ readMode: 'kernel', writeMode: 'kernel', cutoverReady: true }).assertTypedKernelWrite(), true);
});

test('dual-write route wiring shares one transaction and rolls back on parity mismatch', async () => {
  const calls = [];
  const transaction = { insertLegacy: async (value) => { calls.push(['legacy', value]); return value; } };
  const repository = {
    withTransaction: async (callback) => { calls.push(['begin']); return callback(transaction); },
    mirrorLegacyResearchMutationToKernel: async ({ transaction: received, surface, input }) => {
      assert.equal(received, transaction);
      calls.push(['kernel', surface, input.id]);
      return { id: input.id };
    },
    assertLegacyResearchMutationParity: async ({ legacy, kernel }) => legacy.id === kernel.id,
  };
  const rollout = createApiResearchGraphRollout({ writeMode: 'dual_write' });
  const result = await rollout.executeLegacyMutation({
    repository,
    surface: 'claim.create',
    input: { id: 'claim-1' },
    writeLegacy: (tx) => tx.withTransaction((nested) => nested.insertLegacy({ id: 'claim-1' })),
  });
  assert.deepEqual(result, { id: 'claim-1' });
  assert.deepEqual(calls, [['begin'], ['legacy', { id: 'claim-1' }], ['kernel', 'claim.create', 'claim-1']]);

  repository.assertLegacyResearchMutationParity = async () => false;
  await assert.rejects(
    rollout.executeLegacyMutation({ repository, surface: 'claim.create', input: { id: 'claim-2' }, writeLegacy: async () => ({ id: 'claim-2' }) }),
    (error) => error.code === 'RESEARCH_GRAPH_DUAL_WRITE_MISMATCH',
  );
});

test('service-only RPC path captures verified events before one atomic dual write', async () => {
  const event = {
    eventId: '01993f21-16f8-7f01-8e42-0123456789ab',
    eventType: 'claim.created',
    payload: { entity_type: 'claim', claim_id: 'claim-1', revision: 1, actor_id: 'human-1' },
    hash: `sha256:${'a'.repeat(64)}`,
    signature: { algorithm: 'Ed25519', key_id: 'human-key', value: 'external-signature' },
    parents: [],
  };
  const calls = [];
  const repository = {
    executeLegacyResearchMutationDualWrite: async (request) => {
      calls.push(request);
      return { legacy: request.expectedLegacy, kernel: { nodeId: 'claim-1' }, parity: true };
    },
  };
  const verified = [];
  const rollout = createApiResearchGraphRollout({
    writeMode: 'dual_write',
    verifyResearchEvent: async (request) => { verified.push(request); return true; },
  });
  const result = await rollout.executeLegacyMutation({
    repository,
    surface: 'claim.create',
    input: { claimId: 'claim-1', actorId: 'human-1' },
    writeLegacy: (capture) => capture.withTransaction(async (tx) => {
      const claim = await tx.insertClaim({ claimId: 'claim-1', createdBy: 'human-1' });
      const persistedEvent = await tx.appendResearchEvent(event);
      return { claim, event: persistedEvent };
    }),
  });
  assert.equal(result.claim.claimId, 'claim-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mutationKind, 'claim.create');
  assert.deepEqual(calls[0].verifiedEvents, [event]);
  assert.equal(calls[0].expectedLegacy.event.hash, event.hash);
  assert.equal(verified.length, 1);
  assert.equal(verified[0].mutationKind, 'claim.create');
});

test('service RPC capture preserves canonical snake-case Events for separately attributed drafts', async () => {
  const calls = [];
  const repository = {
    executeLegacyResearchMutationDualWrite: async (request) => {
      calls.push(request);
      return { legacy: request.expectedLegacy, kernel: { nodeId: 'claim-agent-draft' }, parity: true };
    },
  };
  const rollout = createApiResearchGraphRollout({
    writeMode: 'dual_write',
    verifyResearchEvent: async ({ event }) => event.event_id === '01993f21-16f8-7f01-8e42-0123456789ab',
  });
  const command = {
    actorId: 'human-1', actorRole: 'maintainer', draftedByActorId: 'agent-1',
    publisherSignatureEnvelope: { schema: 'srp.client-signature-envelope.v1' },
    claimId: 'claim-agent-draft', questionId: null, statement: 'An attributed draft.',
    scope: {}, assumptions: [], falsification: {},
  };
  const result = await rollout.executeLegacyMutation({
    repository,
    surface: 'claim.create',
    input: command,
    writeLegacy: (capture) => createClaim({
      repository: capture,
      ...command,
      eventFactory: async ({ eventType, payload }) => ({
        schema: 'srp.event.v1',
        event_id: '01993f21-16f8-7f01-8e42-0123456789ab',
        event_type: eventType,
        payload,
        hash: `sha256:${'a'.repeat(64)}`,
        signature: { algorithm: 'Ed25519', key_id: 'human-key', value: 'external-signature' },
        parents: [],
      }),
    }),
  });

  assert.equal(result.contribution.actorId, 'agent-1');
  assert.equal(result.event.eventId, '01993f21-16f8-7f01-8e42-0123456789ab');
  assert.equal(calls[0].verifiedEvents[0].event_id, '01993f21-16f8-7f01-8e42-0123456789ab');
  assert.equal(calls[0].expectedLegacy.event.eventId, calls[0].verifiedEvents[0].event_id);
});

test('service-only RPC path requires both legacy and kernel parity projections', async () => {
  const event = {
    eventId: '01993f21-16f8-7f01-8e42-0123456789ab',
    eventType: 'claim.created',
    payload: { entity_type: 'claim', claim_id: 'claim-1', revision: 1, actor_id: 'human-1' },
    hash: `sha256:${'a'.repeat(64)}`,
    signature: { algorithm: 'Ed25519', key_id: 'human-key', value: 'external-signature' },
    parents: [],
  };
  const repository = {
    executeLegacyResearchMutationDualWrite: async (request) => ({ legacy: request.expectedLegacy, parity: true }),
  };
  const rollout = createApiResearchGraphRollout({ writeMode: 'dual_write', verifyResearchEvent: async () => true });
  await assert.rejects(
    rollout.executeLegacyMutation({
      repository,
      surface: 'claim.create',
      input: { claimId: 'claim-1', actorId: 'human-1' },
      writeLegacy: async (capture) => {
        const claim = await capture.insertClaim({ claimId: 'claim-1', createdBy: 'human-1' });
        const persistedEvent = await capture.appendResearchEvent(event);
        return { claim, event: persistedEvent };
      },
    }),
    (error) => error.code === 'RESEARCH_GRAPH_DUAL_WRITE_MISMATCH',
  );
});

test('service-only RPC path fails closed without an injected event verifier', async () => {
  const event = {
    event_id: '01993f21-16f8-7f01-8e42-0123456789ab',
    event_type: 'claim.created',
    payload: { entity_type: 'claim', claim_id: 'claim-1', revision: 1, actor_id: 'human-1' },
    hash: `sha256:${'a'.repeat(64)}`,
    signature: { algorithm: 'Ed25519', key_id: 'human-key', value: 'external-signature' },
    parents: [],
  };
  const repository = { executeLegacyResearchMutationDualWrite: async () => assert.fail('RPC must not run') };
  const rollout = createApiResearchGraphRollout({ writeMode: 'dual_write' });
  await assert.rejects(
    rollout.executeLegacyMutation({
      repository,
      surface: 'claim.create',
      input: { claimId: 'claim-1', actorId: 'human-1' },
      writeLegacy: async (capture) => ({
        claim: await capture.insertClaim({ claimId: 'claim-1' }),
        event: await capture.appendResearchEvent(event),
      }),
    }),
    (error) => error.code === 'RESEARCH_GRAPH_DUAL_WRITE_VERIFIER_UNAVAILABLE' && error.status === 503,
  );
});

test('production env parsing rejects ambiguous gates and invalid mode combinations', () => {
  assert.throws(() => createResearchGraphRolloutFromEnv({ RESEARCH_GRAPH_CUTOVER_READY: 'yes' }), /must be true or false/);
  assert.throws(() => createResearchGraphRolloutFromEnv({ RESEARCH_GRAPH_READ_MODE: 'kernel', RESEARCH_GRAPH_WRITE_MODE: 'legacy' }), /kernel reads cannot run with legacy-only writes/);
});
