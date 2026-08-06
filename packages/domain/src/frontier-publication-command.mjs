import { assertProjectRoleForAction } from './project-authorization.mjs';

export class FrontierPublicationCommandError extends Error {
  constructor(message, code = 'FRONTIER_PUBLICATION_INVALID', status = 400) { super(message); this.name = 'FrontierPublicationCommandError'; this.code = code; this.status = status; }
}

function text(value, field) { if (typeof value !== 'string' || !value.trim()) throw new FrontierPublicationCommandError(`${field} must be a non-empty string`); return value.trim(); }

/** Publish an immutable FrontierSnapshot by appending its auditable event. */
export async function publishFrontier({ repository, actorId, actorRole, snapshotId, eventFactory } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function' || typeof repository.getFrontierSnapshot !== 'function' || typeof repository.appendResearchEvent !== 'function') throw new FrontierPublicationCommandError('repository frontier publication methods are required');
  actorId = text(actorId, 'actor id'); snapshotId = text(snapshotId, 'snapshot id');
  if (typeof eventFactory !== 'function') throw new FrontierPublicationCommandError('eventFactory is required');
  assertProjectRoleForAction({ actorRole, requiredRole: 'maintainer' });
  return repository.withTransaction(async (transaction) => {
    const snapshot = await transaction.getFrontierSnapshot(snapshotId);
    if (!snapshot) throw new FrontierPublicationCommandError('frontier snapshot not found', 'FRONTIER_SNAPSHOT_NOT_FOUND', 404);
    const event = await eventFactory({ eventType: 'frontier.published', payload: { entity_type: 'frontier_snapshot', snapshot_id: snapshotId, project_id: snapshot.projectId, sequence: snapshot.sequence, actor_id: actorId } });
    if (!event || typeof event !== 'object') throw new FrontierPublicationCommandError('eventFactory must return an event object');
    return { snapshot, event: await transaction.appendResearchEvent(event) ?? event };
  });
}
