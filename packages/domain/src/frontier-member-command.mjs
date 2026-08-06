import { assertProjectRoleForAction } from './project-authorization.mjs';

export class FrontierMemberCommandError extends Error {
  constructor(message, code = 'FRONTIER_MEMBER_INVALID', status = 400) { super(message); this.name = 'FrontierMemberCommandError'; this.code = code; this.status = status; }
}

function text(value, field) { if (typeof value !== 'string' || !value.trim()) throw new FrontierMemberCommandError(`${field} must be a non-empty string`); return value.trim(); }
function positive(value, field) { if (!Number.isInteger(value) || value < 1) throw new FrontierMemberCommandError(`${field} must be a positive integer`); return value; }

/** Add one immutable Claim revision to a FrontierSnapshot. */
export async function addFrontierMember({ repository, actorId, actorRole, snapshotId, claimId, claimRevision, membershipType, eventFactory } = {}) {
  const methods = ['withTransaction', 'getFrontierSnapshot', 'getClaimRevision', 'insertFrontierMember', 'appendResearchEvent'];
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) throw new FrontierMemberCommandError('repository frontier member methods are required');
  snapshotId = text(snapshotId, 'snapshot id'); actorId = text(actorId, 'actor id'); claimId = text(claimId, 'claim id'); claimRevision = positive(claimRevision, 'claim revision'); membershipType = text(membershipType, 'membership type');
  if (typeof eventFactory !== 'function') throw new FrontierMemberCommandError('eventFactory is required');
  assertProjectRoleForAction({ actorRole, requiredRole: 'maintainer' });
  return repository.withTransaction(async (transaction) => {
    if (!await transaction.getFrontierSnapshot(snapshotId)) throw new FrontierMemberCommandError('frontier snapshot not found', 'FRONTIER_SNAPSHOT_NOT_FOUND', 404);
    if (!await transaction.getClaimRevision(claimId, claimRevision)) throw new FrontierMemberCommandError('claim revision not found', 'CLAIM_REVISION_NOT_FOUND', 404);
    const member = { snapshotId, claimId, claimRevision, membershipType };
    const event = await eventFactory({ eventType: 'frontier.member_added', payload: { entity_type: 'frontier_member', snapshot_id: snapshotId, claim_id: claimId, claim_revision: claimRevision, membership_type: membershipType, actor_id: actorId } });
    if (!event || typeof event !== 'object') throw new FrontierMemberCommandError('eventFactory must return an event object');
    return { member: await transaction.insertFrontierMember(member) ?? member, event: await transaction.appendResearchEvent(event) ?? event };
  });
}
