export class ReverificationTaskWorkerError extends Error {
  constructor(message, code = 'REVERIFICATION_TASK_INVALID') {
    super(message);
    this.name = 'ReverificationTaskWorkerError';
    this.code = code;
  }
}

/** Create exactly one re-verification Task for each tainted downstream Claim. */
export async function createReverificationTasksJob({ repository, sourceClaimId, impactedClaimIds, taskIdFactory } = {}) {
  if (!repository || typeof repository.getClaim !== 'function' || typeof repository.listReverificationTasksByClaim !== 'function' || typeof repository.createReverificationTask !== 'function') {
    throw new ReverificationTaskWorkerError('repository re-verification task methods are required');
  }
  if (typeof sourceClaimId !== 'string' || !sourceClaimId.trim()) throw new ReverificationTaskWorkerError('source claim id must be a non-empty string');
  if (!Array.isArray(impactedClaimIds) || impactedClaimIds.some((id) => typeof id !== 'string' || !id.trim())) throw new ReverificationTaskWorkerError('impacted claim IDs must be a string array');
  if (typeof taskIdFactory !== 'function') throw new ReverificationTaskWorkerError('taskIdFactory is required');

  const normalizedSourceClaimId = sourceClaimId.trim();
  const createdTasks = [];
  for (const claimId of [...new Set(impactedClaimIds.map((id) => id.trim()))].sort()) {
    if (claimId === normalizedSourceClaimId) continue;
    const claim = await repository.getClaim(claimId);
    if (!claim) throw new ReverificationTaskWorkerError(`impacted claim not found: ${claimId}`, 'IMPACTED_CLAIM_NOT_FOUND');
    const existing = await repository.listReverificationTasksByClaim(claimId, { sourceClaimId: normalizedSourceClaimId });
    if ((existing ?? []).length > 0) continue;
    const taskId = await taskIdFactory({ claimId, sourceClaimId: normalizedSourceClaimId });
    if (typeof taskId !== 'string' || !taskId.trim()) throw new ReverificationTaskWorkerError('taskIdFactory must return a non-empty string');
    const task = await repository.createReverificationTask({ taskId: taskId.trim(), claimId, sourceClaimId: normalizedSourceClaimId });
    createdTasks.push(task ?? { taskId: taskId.trim(), claimId, sourceClaimId: normalizedSourceClaimId });
  }
  return Object.freeze({ sourceClaimId: normalizedSourceClaimId, createdTasks: Object.freeze(createdTasks) });
}
