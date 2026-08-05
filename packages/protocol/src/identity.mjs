export const IDENTITY_STRENGTHS = Object.freeze([
  'verified',
  'observed',
  'self_declared',
  'unknown',
]);

const IDENTITY_STRENGTH_SET = new Set(IDENTITY_STRENGTHS);

export function isIdentityStrength(value) {
  return typeof value === 'string' && IDENTITY_STRENGTH_SET.has(value);
}

export function assertIdentityStrength(value) {
  if (!isIdentityStrength(value)) {
    throw new TypeError(`unsupported identity strength: ${String(value)}`);
  }

  return value;
}
