export const QUESTION_STATES = Object.freeze([
  'draft',
  'proposed',
  'under_review',
  'admissible',
  'active',
  'resolved',
  'archived',
  'rejected',
]);

const QUESTION_STATE_SET = new Set(QUESTION_STATES);
const QUESTION_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['proposed']),
  proposed: Object.freeze(['under_review']),
  under_review: Object.freeze(['admissible', 'rejected']),
  admissible: Object.freeze(['active', 'rejected']),
  active: Object.freeze(['resolved', 'archived']),
  resolved: Object.freeze(['archived']),
  archived: Object.freeze([]),
  rejected: Object.freeze([]),
});

export function isQuestionState(value) {
  return typeof value === 'string' && QUESTION_STATE_SET.has(value);
}

export function assertQuestionState(value) {
  if (!isQuestionState(value)) {
    throw new TypeError(`unsupported question state: ${String(value)}`);
  }

  return value;
}

export function questionTransitionsFrom(state) {
  assertQuestionState(state);
  return QUESTION_TRANSITIONS[state];
}

export function canTransitionQuestion(from, to) {
  return isQuestionState(from) && QUESTION_TRANSITIONS[from].includes(to);
}

export function assertQuestionTransition(from, to) {
  assertQuestionState(from);
  assertQuestionState(to);

  if (!canTransitionQuestion(from, to)) {
    throw new RangeError(`invalid question state transition: ${from} -> ${to}`);
  }

  return true;
}
