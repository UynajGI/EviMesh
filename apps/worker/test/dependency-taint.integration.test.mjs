import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateChallengeImpactJob } from '../src/challenge-impact-worker.mjs';
import { taintDependentClaimsJob } from '../src/dependency-taint-worker.mjs';

test('an upheld upstream Challenge taints every downstream Claim', async () => {
  const claims = new Map([
    ['claim-root', { claimId: 'claim-root', state: 'contested' }],
    ['claim-child-a', { claimId: 'claim-child-a', state: 'accepted' }],
    ['claim-child-b', { claimId: 'claim-child-b', state: 'candidate' }],
  ]);
  const repository = {
    getCurrentChallengeRevision: async () => ({ revision: 2, state: 'upheld', targetClaimId: 'claim-root' }),
    getClaimDownstreamGraph: async () => [{ claimId: 'claim-child-b' }, { claimId: 'claim-child-a' }],
    getClaim: async (claimId) => claims.get(claimId) ?? null,
    markClaimDependencyTainted: async (claimId, { sourceClaimId }) => claims.set(claimId, { ...claims.get(claimId), state: 'dependency_tainted', sourceClaimId }),
  };
  const impact = await calculateChallengeImpactJob({ repository, challengeId: 'challenge-1', challengeRevision: 2 });
  const taint = await taintDependentClaimsJob({ repository, sourceClaimId: 'claim-root', impactedClaimIds: impact.impactedClaimIds });
  assert.deepEqual(taint.taintedClaimIds, ['claim-child-a', 'claim-child-b']);
  assert.equal(claims.get('claim-root').state, 'contested');
  assert.equal(claims.get('claim-child-a').state, 'dependency_tainted');
  assert.equal(claims.get('claim-child-b').state, 'dependency_tainted');
});
