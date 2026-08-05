export const PROJECT_STATES = Object.freeze(['draft', 'active', 'archived']);

const PROJECT_STATE_SET = new Set(PROJECT_STATES);
const PROJECT_TRANSITIONS = Object.freeze({
  draft: Object.freeze(['active', 'archived']),
  active: Object.freeze(['archived']),
  archived: Object.freeze([]),
});

export function isProjectState(value) {
  return typeof value === 'string' && PROJECT_STATE_SET.has(value);
}

export function assertProjectState(value) {
  if (!isProjectState(value)) {
    throw new TypeError(`unsupported project state: ${String(value)}`);
  }

  return value;
}

export function projectTransitionsFrom(state) {
  assertProjectState(state);
  return PROJECT_TRANSITIONS[state];
}

export function canTransitionProject(from, to) {
  return isProjectState(from) && PROJECT_TRANSITIONS[from].includes(to);
}

export function assertProjectTransition(from, to) {
  assertProjectState(from);
  assertProjectState(to);

  if (!canTransitionProject(from, to)) {
    throw new RangeError(`invalid project state transition: ${from} -> ${to}`);
  }

  return true;
}
