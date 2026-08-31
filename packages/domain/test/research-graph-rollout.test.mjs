import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareResearchGraphParity,
  executeResearchGraphWrite,
  readResearchGraphWithShadow,
} from '../src/research-graph-rollout.mjs';

const ref = (kind, id, revision = 1) => ({ kind, id, revision });
const graph = ({ extra = false, permissionPartial = false } = {}) => ({
  nodes: [
    { ref: ref('question', 'q1') },
    { ref: ref('answer', 'a1') },
    ...(extra ? [{ ref: ref('claim', 'c1') }] : []),
  ],
  edges: [{ type: 'answers', source: ref('question', 'q1'), target: ref('answer', 'a1') }],
  truncated: false,
  permissionPartial,
});

test('reports semantic node/edge parity without comparing presentation or watermarks', () => {
  assert.equal(compareResearchGraphParity({ legacy: graph(), kernel: graph() }).matches, true);
  const mismatch = compareResearchGraphParity({ legacy: graph(), kernel: graph({ extra: true }) });
  assert.equal(mismatch.matches, false);
  assert.deepEqual(mismatch.unexpectedKernelNodes, ['claim:c1@1']);
  assert.equal(compareResearchGraphParity({ legacy: graph(), kernel: graph({ permissionPartial: true }) }).visibilityComparable, false);
});

test('shadow reads keep legacy authoritative and emit internal parity only', async () => {
  const reports = [];
  const legacy = graph();
  const result = await readResearchGraphWithShadow({
    mode: 'shadow', readLegacy: async () => legacy, readKernel: async () => graph({ extra: true }),
    onParity: async (report) => reports.push(report),
  });
  assert.equal(result, legacy);
  assert.equal(reports[0].matches, false);
  assert.equal('missingKernelNodes' in result, false);
});

test('shadow kernel failures never replace a valid legacy response', async () => {
  const reports = [];
  const legacy = graph();
  const result = await readResearchGraphWithShadow({
    mode: 'shadow', readLegacy: async () => legacy, readKernel: async () => { throw new Error('kernel unavailable'); },
    onParity: async (report) => reports.push(report),
  });
  assert.equal(result, legacy);
  assert.equal(reports[0].matches, false);
  assert.match(reports[0].shadowError, /kernel unavailable/);
});

test('shadow telemetry failures never replace a valid legacy response', async () => {
  const legacy = graph();
  const result = await readResearchGraphWithShadow({
    mode: 'shadow', readLegacy: async () => legacy, readKernel: async () => graph(),
    onParity: async () => { throw new Error('telemetry unavailable'); },
  });
  assert.equal(result, legacy);
});

test('kernel reads and writes require an explicit passed cutover gate', async () => {
  await assert.rejects(readResearchGraphWithShadow({ mode: 'kernel', readKernel: async () => graph() }), (error) => error.code === 'RESEARCH_GRAPH_CUTOVER_BLOCKED');
  const repository = { withTransaction: (callback) => callback(repository) };
  await assert.rejects(executeResearchGraphWrite({ repository, mode: 'kernel', writeKernel: async () => ({}) }), (error) => error.code === 'RESEARCH_GRAPH_CUTOVER_BLOCKED');
});

test('dual-write parity mismatch throws inside the shared transaction', async () => {
  const calls = [];
  const repository = { withTransaction: async (callback) => { calls.push('begin'); const result = await callback(repository); calls.push('commit'); return result; } };
  await assert.rejects(
    executeResearchGraphWrite({
      repository, mode: 'dual_write',
      writeLegacy: async () => { calls.push('legacy'); return { id: 'x' }; },
      writeKernel: async () => { calls.push('kernel'); return { id: 'y' }; },
      assertParity: async () => false,
    }),
    (error) => error.code === 'RESEARCH_GRAPH_DUAL_WRITE_MISMATCH',
  );
  assert.deepEqual(calls, ['begin', 'legacy', 'kernel']);
});

test('dual-write success returns both projections after parity confirmation', async () => {
  const repository = { withTransaction: (callback) => callback(repository) };
  const result = await executeResearchGraphWrite({
    repository, mode: 'dual_write',
    writeLegacy: async () => ({ id: 'x' }),
    writeKernel: async () => ({ id: 'x' }),
    assertParity: async ({ legacy, kernel }) => legacy.id === kernel.id,
  });
  assert.deepEqual(result, { legacy: { id: 'x' }, kernel: { id: 'x' } });
});
