import test from 'node:test';
import assert from 'node:assert/strict';
import { getEvidence, listEvidence, EvidenceQueryError } from '../src/evidence-query.mjs';

const evidence = [
  { evidenceId: 'evidence_b', createdAt: '2026-01-02T00:00:00.000Z' },
  { evidenceId: 'evidence_a', createdAt: '2026-01-01T00:00:00.000Z' },
];

test('lists evidence with type and claim filters', async () => {
  const calls = [];
  const page = await listEvidence({ repository: { listEvidence: async (filters) => { calls.push(filters); return evidence; } }, evidenceType: 'benchmark', claimId: ' claim_1 ', limit: 1 });
  assert.deepEqual(calls, [{ evidenceType: 'benchmark', claimId: 'claim_1' }]);
  assert.deepEqual(page.items, [evidence[1]]);
  assert.ok(page.nextCursor);
});

test('returns evidence with claim revision links', async () => {
  const repository = { getEvidence: async (evidenceId) => ({ evidenceId }), listEvidenceClaimLinks: async () => [{ claimId: 'claim_1', claimRevision: 2, relationType: 'supports' }] };
  assert.deepEqual(await getEvidence({ repository, evidenceId: ' evidence_1 ' }), { evidence: { evidenceId: 'evidence_1' }, claimLinks: [{ claimId: 'claim_1', claimRevision: 2, relationType: 'supports' }] });
});

test('rejects invalid or missing evidence queries', async () => {
  await assert.rejects(() => listEvidence({ repository: { listEvidence: async () => evidence }, limit: 0 }), EvidenceQueryError);
  await assert.rejects(() => getEvidence({ repository: {}, evidenceId: 'evidence_1' }), EvidenceQueryError);
  await assert.rejects(() => getEvidence({ repository: { getEvidence: async () => null, listEvidenceClaimLinks: async () => [] }, evidenceId: 'evidence_1' }), (error) => error.code === 'EVIDENCE_NOT_FOUND');
});
