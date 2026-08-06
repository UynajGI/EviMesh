export class FrontierQueryError extends Error {
  constructor(message, code = 'FRONTIER_QUERY_INVALID', status = 400) { super(message); this.name = 'FrontierQueryError'; this.code = code; this.status = status; }
}

function projectId(value) {
  if (typeof value !== 'string' || !value.trim()) throw new FrontierQueryError('project id must be a non-empty string');
  return value.trim();
}

/** Return the FrontierSnapshot with the maximum sequence for one Project, or null before genesis. */
export async function getLatestFrontier({ repository, projectId: value } = {}) {
  if (!repository || typeof repository.listFrontierSnapshots !== 'function') throw new FrontierQueryError('repository listFrontierSnapshots is required');
  const snapshots = await repository.listFrontierSnapshots({ projectId: projectId(value) });
  if (!Array.isArray(snapshots) || snapshots.length === 0) return null;
  const valid = snapshots.filter((snapshot) => snapshot && Number.isInteger(snapshot.sequence) && snapshot.sequence > 0);
  if (valid.length !== snapshots.length) throw new FrontierQueryError('repository returned an invalid frontier sequence', 'FRONTIER_SEQUENCE_INVALID', 500);
  return valid.reduce((latest, snapshot) => snapshot.sequence > latest.sequence ? snapshot : latest);
}
