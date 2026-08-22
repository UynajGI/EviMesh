export class ChallengeImpactWorkerError extends Error {
  constructor(message, code = 'CHALLENGE_IMPACT_INVALID') { super(message); this.name = 'ChallengeImpactWorkerError'; this.code = code; }
}

/** Compute the complete, stable downstream Claim set affected by an upheld Challenge. */
export async function calculateChallengeImpactJob({ repository, challengeId, challengeRevision } = {}) {
  if (!repository || typeof repository.getCurrentChallengeRevision !== 'function' || typeof repository.listDirectDependentClaimIds !== 'function') throw new ChallengeImpactWorkerError('repository challenge impact methods are required');
  if (typeof challengeId !== 'string' || !challengeId.trim()) throw new ChallengeImpactWorkerError('challenge id must be a non-empty string');
  if (!Number.isInteger(challengeRevision) || challengeRevision < 1) throw new ChallengeImpactWorkerError('challenge revision must be a positive integer');
  const revision = await repository.getCurrentChallengeRevision(challengeId.trim());
  if (!revision || revision.revision !== challengeRevision) throw new ChallengeImpactWorkerError('challenge revision not found', 'CHALLENGE_REVISION_NOT_FOUND');
  if (revision.state !== 'upheld') return Object.freeze({ challengeId: challengeId.trim(), challengeRevision, impactedClaimIds: Object.freeze([]) });
  const identifiers = new Set([revision.targetClaimId]);
  const pending = [revision.targetClaimId];
  // Dependency impact is intentionally read from the unpruned relation index,
  // never from the presentation graph whose mixed relation edges may be pruned.
  while (pending.length > 0) {
    const claimId = pending.shift();
    const dependentIds = await repository.listDirectDependentClaimIds(claimId);
    for (const dependentId of Array.isArray(dependentIds) ? dependentIds : []) {
      if (typeof dependentId !== 'string' || !dependentId || identifiers.has(dependentId)) continue;
      identifiers.add(dependentId);
      pending.push(dependentId);
    }
  }
  return Object.freeze({ challengeId: challengeId.trim(), challengeRevision, impactedClaimIds: Object.freeze([...identifiers].sort()) });
}
