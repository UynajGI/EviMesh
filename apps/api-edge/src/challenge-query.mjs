import { challengeTransitionsFrom } from "../../../packages/protocol/src/challenge-state.mjs";

export class ChallengeQueryError extends Error {
  constructor(message, code = "CHALLENGE_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "ChallengeQueryError";
    this.code = code;
    this.status = status;
  }
}

function requiredId(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ChallengeQueryError("challenge id must be a non-empty string");
  }
  return value.trim();
}

/** Return a Challenge with its current revision, impact rows, and linked Evidence. */
export async function getChallenge({ repository, challengeId } = {}) {
  challengeId = requiredId(challengeId);
  const methods = [
    "getChallenge",
    "getCurrentChallengeRevision",
    "listChallengeImpacts",
    "listEvidenceForClaimRevision",
  ];
  if (!repository || methods.some((method) => typeof repository[method] !== "function")) {
    throw new ChallengeQueryError("repository challenge detail methods are required");
  }

  const challenge = await repository.getChallenge(challengeId);
  if (!challenge) throw new ChallengeQueryError("challenge not found", "CHALLENGE_NOT_FOUND", 404);

  const currentRevision = await repository.getCurrentChallengeRevision(challengeId);
  if (!currentRevision) throw new ChallengeQueryError("current challenge revision not found", "CHALLENGE_REVISION_NOT_FOUND", 500);

  let allowedTransitions;
  try {
    allowedTransitions = challengeTransitionsFrom(currentRevision.state);
  } catch (error) {
    throw new ChallengeQueryError(error.message, "CHALLENGE_STATE_INVALID", 500);
  }

  const [impacts, linkedEvidence] = await Promise.all([
    repository.listChallengeImpacts(challengeId, currentRevision.revision),
    repository.listEvidenceForClaimRevision(currentRevision.targetClaimId, currentRevision.targetClaimRevision),
  ]);

  return {
    challenge,
    currentRevision,
    statusPolicy: { state: currentRevision.state, allowedTransitions: [...allowedTransitions] },
    impacts: Array.isArray(impacts) ? impacts : [],
    linkedEvidence: Array.isArray(linkedEvidence) ? linkedEvidence : [],
  };
}
