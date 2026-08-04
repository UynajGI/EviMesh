export const ACTOR_TYPES = Object.freeze([
  'human',
  'agent',
  'organization',
  'service',
  'maintainer',
  'witness',
]);

const ACTOR_TYPE_SET = new Set(ACTOR_TYPES);

export function isActorType(value) {
  return typeof value === 'string' && ACTOR_TYPE_SET.has(value);
}

export function assertActorType(value) {
  if (!isActorType(value)) {
    throw new TypeError(`unsupported actor type: ${String(value)}`);
  }

  return value;
}
