import { assertProjectRoleForAction } from './project-authorization.mjs';

export class FrontierSnapshotCommandError extends Error {
  constructor(message, code = 'FRONTIER_SNAPSHOT_INVALID', status = 400) {
    super(message);
    this.name = 'FrontierSnapshotCommandError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field) { if (typeof value !== 'string' || !value.trim()) throw new FrontierSnapshotCommandError(`${field} must be a non-empty string`); return value.trim(); }
function positive(value, field) { if (!Number.isInteger(value) || value < 1) throw new FrontierSnapshotCommandError(`${field} must be a positive integer`); return value; }

/** Append a FrontierSnapshot to one project's contiguous immutable chain. */
export async function createFrontierSnapshot({ repository, actorId, actorRole, snapshotId, projectId, sequence, previousSequence = null, projectRevision, mergeProposalId, checkpoint = {}, eventFactory } = {}) {
  const methods = ['withTransaction', 'getProjectRevision', 'getMergeProposal', 'getLatestFrontierSnapshot', 'getFrontierSnapshotByProjectSequence', 'insertFrontierSnapshot', 'appendResearchEvent'];
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) throw new FrontierSnapshotCommandError('repository frontier snapshot methods are required');
  snapshotId = text(snapshotId, 'snapshot id'); actorId = text(actorId, 'actor id'); projectId = text(projectId, 'project id'); mergeProposalId = text(mergeProposalId, 'merge proposal id');
  sequence = positive(sequence, 'sequence'); projectRevision = positive(projectRevision, 'project revision');
  if (previousSequence !== null) previousSequence = positive(previousSequence, 'previous sequence');
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) throw new FrontierSnapshotCommandError('checkpoint must be a JSON object');
  if (typeof eventFactory !== 'function') throw new FrontierSnapshotCommandError('eventFactory is required');
  assertProjectRoleForAction({ actorRole, requiredRole: 'maintainer' });

  return repository.withTransaction(async (transaction) => {
    if (!await transaction.getProjectRevision(projectId, projectRevision)) throw new FrontierSnapshotCommandError('project revision not found', 'PROJECT_REVISION_NOT_FOUND', 404);
    const proposal = await transaction.getMergeProposal(mergeProposalId);
    if (!proposal || proposal.status !== 'ready') throw new FrontierSnapshotCommandError('ready merge proposal not found', 'MERGE_PROPOSAL_NOT_READY', 409);
    const latest = await transaction.getLatestFrontierSnapshot(projectId);
    const expectedSequence = latest ? latest.sequence + 1 : 1;
    if (sequence !== expectedSequence || previousSequence !== (latest ? latest.sequence : null)) throw new FrontierSnapshotCommandError('frontier sequence must immediately follow the latest snapshot', 'FRONTIER_SEQUENCE_INVALID', 409);
    if (previousSequence !== null && !await transaction.getFrontierSnapshotByProjectSequence(projectId, previousSequence)) throw new FrontierSnapshotCommandError('previous frontier snapshot not found', 'PREVIOUS_FRONTIER_NOT_FOUND', 404);
    const snapshot = { snapshotId, projectId, sequence, previousSequence, projectRevision, checkpoint: { ...checkpoint, mergeProposalId }, createdBy: actorId };
    const event = await eventFactory({ eventType: 'frontier.created', payload: { entity_type: 'frontier_snapshot', snapshot_id: snapshotId, project_id: projectId, sequence, previous_sequence: previousSequence, merge_proposal_id: mergeProposalId, actor_id: actorId } });
    if (!event || typeof event !== 'object') throw new FrontierSnapshotCommandError('eventFactory must return an event object');
    return { snapshot: await transaction.insertFrontierSnapshot(snapshot) ?? snapshot, event: await transaction.appendResearchEvent(event) ?? event };
  });
}
