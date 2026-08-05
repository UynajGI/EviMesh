export const ATTEMPT_STATES = Object.freeze([
  'active',
  'paused',
  'submitted',
  'abandoned',
]);

const ATTEMPT_STATE_SET = new Set(ATTEMPT_STATES);
const ATTEMPT_TRANSITIONS = Object.freeze({
  active: Object.freeze(['paused', 'submitted', 'abandoned']),
  paused: Object.freeze(['active', 'submitted', 'abandoned']),
  submitted: Object.freeze([]),
  abandoned: Object.freeze([]),
});

export function isAttemptState(value) {
  return typeof value === 'string' && ATTEMPT_STATE_SET.has(value);
}

export function assertAttemptState(value) {
  if (!isAttemptState(value)) {
    throw new TypeError(`unsupported attempt state: ${String(value)}`);
  }

  return value;
}

export function attemptTransitionsFrom(state) {
  assertAttemptState(state);
  return ATTEMPT_TRANSITIONS[state];
}

export function canTransitionAttempt(from, to) {
  return isAttemptState(from) && ATTEMPT_TRANSITIONS[from].includes(to);
}

export function assertAttemptTransition(from, to) {
  assertAttemptState(from);
  assertAttemptState(to);

  if (!canTransitionAttempt(from, to)) {
    throw new RangeError(`invalid attempt state transition: ${from} -> ${to}`);
  }

  return true;
}
