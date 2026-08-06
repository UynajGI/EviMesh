export class ChallengeImpactWorkerError extends Error {
  constructor(message, code = 'CHALLENGE_IMPACT_INVALID') { super(message); this.name = 'ChallengeImpactWorkerError'; this.code = code; }
}

/** Compute the complete, stable downstream Claim set affected by an upheld Challenge. */
export async function calculateChallengeImpactJob({ repository, challengeId, challengeRevision } = {}) {
  if (!repository || typeof repository.getCurrentChallengeRevision !== 'function' || typeof repository.getClaimDownstreamGraph !== 'function') throw new ChallengeImpactWorkerError('repository challenge impact methods are required');
  if (typeof challengeId !== 'string' || !challengeId.trim()) throw new ChallengeImpactWorkerError('challenge id must be a non-empty string');
  if (!Number.isInteger(challengeRevision) || challengeRevision < 1) throw new ChallengeImpactWorkerError('challenge revision must be a positive integer');
  const revision = await repository.getCurrentChallengeRevision(challengeId.trim());
  if (!revision || revision.revision !== challengeRevision) throw new ChallengeImpactWorkerError('challenge revision not found', 'CHALLENGE_REVISION_NOT_FOUND');
  if (revision.state !== 'upheld') return Object.freeze({ challengeId: challengeId.trim(), challengeRevision, impactedClaimIds: Object.freeze([]) });
  const identifiers = new Set([revision.targetClaimId]);
  const pending = [revision.targetClaimId];
  // The graph adapter is intentionally bounded. Re-querying each discovered
  // node exhausts an acyclic graph without silently truncating long chains.
  while (pending.length > 0) {
    const claimId = pending.shift();
    const nodes = await repository.getClaimDownstreamGraph({ claimId, maxDepth: 32 });
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (typeof node.claimId !== 'string' || !node.claimId || identifiers.has(node.claimId)) continue;
      identifiers.add(node.claimId);
      pending.push(node.claimId);
    }
  }
  return Object.freeze({ challengeId: challengeId.trim(), challengeRevision, impactedClaimIds: Object.freeze([...identifiers].sort()) });
}
