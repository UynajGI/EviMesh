import test from 'node:test';
import assert from 'node:assert/strict';
import { addFrontierMember, FrontierMemberCommandError } from '../src/frontier-member-command.mjs';

function repository() { const repo = { withTransaction: async (callback) => callback(repo), getFrontierSnapshot: async () => ({ snapshotId: 'frontier-1' }), getClaimRevision: async (claimId, revision) => ({ claimId, revision }), insertFrontierMember: async (member) => member, appendResearchEvent: async (event) => event }; return repo; }
const input = { actorId: 'actor-1', actorRole: 'maintainer', snapshotId: 'frontier-1', claimId: 'claim-1', claimRevision: 2, membershipType: 'supporting', eventFactory: async (event) => event };

test('writes a Frontier member that pins an existing Claim revision', async () => {
  const result = await addFrontierMember({ repository: repository(), ...input });
  assert.deepEqual(result.member, { snapshotId: 'frontier-1', claimId: 'claim-1', claimRevision: 2, membershipType: 'supporting' });
  assert.equal(result.event.eventType, 'frontier.member_added');
});

test('rejects a missing fixed Claim revision before writing a member', async () => {
  const repo = repository(); repo.getClaimRevision = async () => null;
  await assert.rejects(() => addFrontierMember({ repository: repo, ...input }), (error) => error instanceof FrontierMemberCommandError && error.code === 'CLAIM_REVISION_NOT_FOUND');
});
