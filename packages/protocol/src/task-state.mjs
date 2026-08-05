export const TASK_STATES = Object.freeze([
  'draft',
  'open',
  'active',
  'blocked',
  'verification_requested',
  'completed',
  'cancelled',
]);

const TASK_STATE_SET = new Set(TASK_STATES);
const TASK_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['open', 'cancelled']),
  open: Object.freeze(['active', 'cancelled']),
  active: Object.freeze(['blocked', 'verification_requested', 'completed', 'cancelled']),
  blocked: Object.freeze(['active', 'cancelled']),
  verification_requested: Object.freeze(['active', 'completed', 'cancelled']),
  completed: Object.freeze([]),
  cancelled: Object.freeze([]),
});

export function isTaskState(value) {
  return typeof value === 'string' && TASK_STATE_SET.has(value);
}

export function assertTaskState(value) {
  if (!isTaskState(value)) {
    throw new TypeError(`unsupported task state: ${String(value)}`);
  }

  return value;
}

export function taskTransitionsFrom(state) {
  assertTaskState(state);
  return TASK_TRANSITIONS[state];
}

export function canTransitionTask(from, to) {
  return isTaskState(from) && TASK_TRANSITIONS[from].includes(to);
}

export function assertTaskTransition(from, to) {
  assertTaskState(from);
  assertTaskState(to);

  if (!canTransitionTask(from, to)) {
    throw new RangeError(`invalid task state transition: ${from} -> ${to}`);
  }

  return true;
}
