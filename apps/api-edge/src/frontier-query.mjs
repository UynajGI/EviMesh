import { paginate } from './pagination.mjs';

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

/** Page through a Project's immutable FrontierSnapshot history with an opaque stable cursor. */
export async function listFrontierHistory({ repository, projectId: value, limit = 20, cursor = null } = {}) {
  if (!repository || typeof repository.listFrontierSnapshots !== 'function') throw new FrontierQueryError('repository listFrontierSnapshots is required');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new FrontierQueryError('limit must be an integer between 1 and 100');
  if (cursor !== null && cursor !== undefined && (typeof cursor !== 'string' || !cursor)) throw new FrontierQueryError('cursor must be a non-empty string or null');
  const snapshots = await repository.listFrontierSnapshots({ projectId: projectId(value) });
  const page = paginate(snapshots, { limit, cursor: cursor ?? null, getKey: (snapshot) => ({ createdAt: snapshot.createdAt, id: snapshot.snapshotId }) });
  const items = typeof repository.listFrontierMembers === 'function'
    ? await Promise.all(page.items.map(async (snapshot) => ({
      ...snapshot,
      members: await repository.listFrontierMembers(snapshot.snapshotId),
    })))
    : page.items;
  return { ...page, items };
}

function snapshotId(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new FrontierQueryError(`${field} must be a non-empty string`);
  return value.trim();
}

function memberMap(members) {
  if (!Array.isArray(members)) throw new FrontierQueryError('repository returned invalid frontier members', 'FRONTIER_MEMBER_INVALID', 500);
  const values = new Map();
  for (const member of members) {
    if (!member || typeof member.claimId !== 'string' || !member.claimId.trim() || !Number.isInteger(member.claimRevision) || member.claimRevision < 1 || typeof member.membershipType !== 'string' || !member.membershipType.trim()) throw new FrontierQueryError('repository returned invalid frontier members', 'FRONTIER_MEMBER_INVALID', 500);
    if (values.has(member.claimId)) throw new FrontierQueryError('repository returned duplicate Claim members', 'FRONTIER_MEMBER_DUPLICATE', 500);
    values.set(member.claimId, { claimId: member.claimId, revision: member.claimRevision, status: member.membershipType });
  }
  return values;
}

/** Compare two immutable Frontier snapshots by Claim membership and status. */
export async function diffFrontiers({ repository, projectId = null, fromSnapshotId, toSnapshotId } = {}) {
  const methods = ['getFrontierSnapshot', 'listFrontierMembers'];
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) throw new FrontierQueryError('repository frontier diff methods are required');
  fromSnapshotId = snapshotId(fromSnapshotId, 'from snapshot id'); toSnapshotId = snapshotId(toSnapshotId, 'to snapshot id');
  const [fromSnapshot, toSnapshot, fromMembers, toMembers] = await Promise.all([repository.getFrontierSnapshot(fromSnapshotId), repository.getFrontierSnapshot(toSnapshotId), repository.listFrontierMembers(fromSnapshotId), repository.listFrontierMembers(toSnapshotId)]);
  if (!fromSnapshot || !toSnapshot) throw new FrontierQueryError('frontier snapshot not found', 'FRONTIER_SNAPSHOT_NOT_FOUND', 404);
  if (projectId !== null && (fromSnapshot.projectId !== projectId || toSnapshot.projectId !== projectId)) {
    throw new FrontierQueryError('frontier snapshot not found for this project', 'FRONTIER_SNAPSHOT_NOT_FOUND', 404);
  }
  if (fromSnapshot.projectId !== toSnapshot.projectId) throw new FrontierQueryError('Frontier snapshots must belong to one project', 'FRONTIER_PROJECT_MISMATCH', 409);
  const from = memberMap(fromMembers); const to = memberMap(toMembers);
  const added = [...to.keys()].filter((claimId) => !from.has(claimId)).sort().map((claimId) => to.get(claimId));
  const removed = [...from.keys()].filter((claimId) => !to.has(claimId)).sort().map((claimId) => from.get(claimId));
  const statusChanged = [...to.keys()].filter((claimId) => from.has(claimId) && from.get(claimId).status !== to.get(claimId).status).sort().map((claimId) => ({ claimId, from: from.get(claimId), to: to.get(claimId) }));
  return { fromSnapshot, toSnapshot, added, removed, statusChanged };
}
