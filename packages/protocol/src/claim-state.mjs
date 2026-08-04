export const CLAIM_STATES = Object.freeze([
  'hypothesis',
  'candidate',
  'under_verification',
  'provisionally_accepted',
  'accepted',
  'contested',
  'refuted',
  'superseded',
  'retracted',
  'dependency_tainted',
]);

const CLAIM_STATE_SET = new Set(CLAIM_STATES);
const CLAIM_OUTCOMES = Object.freeze([
  'contested',
  'refuted',
  'superseded',
  'retracted',
  'dependency_tainted',
]);
const CLAIM_PRIMARY_TRANSITIONS = Object.freeze({
  hypothesis: Object.freeze(['candidate']),
  candidate: Object.freeze(['under_verification']),
  under_verification: Object.freeze(['provisionally_accepted']),
  provisionally_accepted: Object.freeze(['accepted']),
  accepted: Object.freeze([]),
});

const CLAIM_TRANSITIONS = Object.freeze({
  hypothesis: Object.freeze(['candidate', ...CLAIM_OUTCOMES]),
  candidate: Object.freeze(['under_verification', ...CLAIM_OUTCOMES]),
  under_verification: Object.freeze(['provisionally_accepted', ...CLAIM_OUTCOMES]),
  provisionally_accepted: Object.freeze(['accepted', ...CLAIM_OUTCOMES]),
  accepted: CLAIM_OUTCOMES,
  contested: Object.freeze([]),
  refuted: Object.freeze([]),
  superseded: Object.freeze([]),
  retracted: Object.freeze([]),
  dependency_tainted: Object.freeze([]),
});

export function isClaimState(value) {
  return typeof value === 'string' && CLAIM_STATE_SET.has(value);
}

export function assertClaimState(value) {
  if (!isClaimState(value)) {
    throw new TypeError(`unsupported claim state: ${String(value)}`);
  }

  return value;
}

export function claimTransitionsFrom(state) {
  assertClaimState(state);
  return CLAIM_TRANSITIONS[state];
}

export function canTransitionClaim(from, to) {
  return isClaimState(from) && CLAIM_TRANSITIONS[from].includes(to);
}

export function assertClaimTransition(from, to) {
  assertClaimState(from);
  assertClaimState(to);

  if (!canTransitionClaim(from, to)) {
    throw new RangeError(`invalid claim state transition: ${from} -> ${to}`);
  }

  return true;
}

export function isClaimOutcome(value) {
  return CLAIM_OUTCOMES.includes(value);
}
