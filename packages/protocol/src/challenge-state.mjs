export const CHALLENGE_STATES = Object.freeze([
  'open',
  'admissible',
  'investigating',
  'upheld',
  'rejected',
  'resolved',
]);

const CHALLENGE_STATE_SET = new Set(CHALLENGE_STATES);
const CHALLENGE_TRANSITIONS = Object.freeze({
  open: Object.freeze(['admissible']),
  admissible: Object.freeze(['investigating']),
  investigating: Object.freeze(['upheld', 'rejected', 'resolved']),
  upheld: Object.freeze([]),
  rejected: Object.freeze([]),
  resolved: Object.freeze([]),
});

export function isChallengeState(value) {
  return typeof value === 'string' && CHALLENGE_STATE_SET.has(value);
}

export function assertChallengeState(value) {
  if (!isChallengeState(value)) {
    throw new TypeError(`unsupported challenge state: ${String(value)}`);
  }

  return value;
}

export function challengeTransitionsFrom(state) {
  assertChallengeState(state);
  return CHALLENGE_TRANSITIONS[state];
}

export function canTransitionChallenge(from, to) {
  return isChallengeState(from) && CHALLENGE_TRANSITIONS[from].includes(to);
}

export function assertChallengeTransition(from, to) {
  assertChallengeState(from);
  assertChallengeState(to);

  if (!canTransitionChallenge(from, to)) {
    throw new RangeError(`invalid challenge state transition: ${from} -> ${to}`);
  }

  return true;
}
