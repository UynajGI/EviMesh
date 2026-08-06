export class DependencyTaintWorkerError extends Error { constructor(message, code = 'DEPENDENCY_TAINT_INVALID') { super(message); this.name = 'DependencyTaintWorkerError'; this.code = code; } }

/** Mark every downstream Claim affected by a contested source as dependency_tainted. */
export async function taintDependentClaimsJob({ repository, sourceClaimId, impactedClaimIds } = {}) {
  if (!repository || typeof repository.getClaim !== 'function' || typeof repository.markClaimDependencyTainted !== 'function') throw new DependencyTaintWorkerError('repository dependency taint methods are required');
  if (typeof sourceClaimId !== 'string' || !sourceClaimId.trim()) throw new DependencyTaintWorkerError('source claim id must be a non-empty string');
  if (!Array.isArray(impactedClaimIds) || impactedClaimIds.some((id) => typeof id !== 'string' || !id.trim())) throw new DependencyTaintWorkerError('impacted claim IDs must be a string array');
  const taintedClaimIds = [];
  for (const claimId of [...new Set(impactedClaimIds.map((id) => id.trim()))].sort()) {
    if (claimId === sourceClaimId.trim()) continue;
    const claim = await repository.getClaim(claimId);
    if (!claim) throw new DependencyTaintWorkerError(`impacted claim not found: ${claimId}`, 'IMPACTED_CLAIM_NOT_FOUND');
    if (claim.state === 'dependency_tainted') continue;
    await repository.markClaimDependencyTainted(claimId, { sourceClaimId: sourceClaimId.trim() });
    taintedClaimIds.push(claimId);
  }
  return Object.freeze({ sourceClaimId: sourceClaimId.trim(), taintedClaimIds: Object.freeze(taintedClaimIds) });
}
