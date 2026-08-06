const CORE_PROJECTION_TYPES = Object.freeze(['projects', 'questions', 'tasks', 'claims']);

export class ResearchEventReplayError extends Error {
  constructor(message, code = 'RESEARCH_EVENT_REPLAY_INVALID') {
    super(message);
    this.name = 'ResearchEventReplayError';
    this.code = code;
  }
}

/** Create empty mutable current-state projections for formal Event replay. */
export function createCoreProjections() {
  return Object.fromEntries(CORE_PROJECTION_TYPES.map((type) => [type, new Map()]));
}

/** Remove only derived current-state projections; immutable Events remain untouched. */
export function clearCoreProjections(projections) {
  assertCoreProjections(projections);
  for (const type of CORE_PROJECTION_TYPES) projections[type].clear();
  return projections;
}

/** Rebuild current core projections from signed Event payload snapshots in append order. */
export function replayCoreProjections({ events, projections = createCoreProjections() } = {}) {
  if (!Array.isArray(events)) throw new ResearchEventReplayError('events must be an array');
  clearCoreProjections(projections);

  for (const event of events) {
    const snapshot = event?.payload?.projection;
    if (snapshot === undefined) continue;
    applySnapshot(projections, snapshot);
  }
  return projections;
}

function assertCoreProjections(projections) {
  if (!projections || typeof projections !== 'object') {
    throw new ResearchEventReplayError('core projections are required');
  }
  for (const type of CORE_PROJECTION_TYPES) {
    if (!(projections[type] instanceof Map)) {
      throw new ResearchEventReplayError(`core projection ${type} must be a Map`);
    }
  }
}

function applySnapshot(projections, snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new ResearchEventReplayError('event projection snapshot must be an object');
  }
  const entityType = snapshot.entity_type;
  const entityId = snapshot.entity_id;
  const revision = snapshot.revision;
  const state = snapshot.state;
  const collection = entityType === 'project' ? 'projects'
    : entityType === 'question' ? 'questions'
      : entityType === 'task' ? 'tasks'
        : entityType === 'claim' ? 'claims' : null;
  if (!collection || typeof entityId !== 'string' || entityId.length === 0 || !Number.isInteger(revision) || revision < 1 || !state || typeof state !== 'object' || Array.isArray(state)) {
    throw new ResearchEventReplayError('event projection snapshot is invalid');
  }
  const previous = projections[collection].get(entityId);
  if (previous && revision <= previous.revision) {
    throw new ResearchEventReplayError('event projection revisions must increase in append order', 'RESEARCH_EVENT_REPLAY_ORDER_INVALID');
  }
  projections[collection].set(entityId, structuredClone({ revision, state }));
}
