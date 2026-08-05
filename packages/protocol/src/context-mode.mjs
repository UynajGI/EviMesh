const MODE_SEMANTICS = {
  frontier: 'use the fixed Frontier snapshot as the bounded research context',
  full_trace: 'include the available trace and provenance context',
  adversarial: 'include challenges, conflicts, and counter-evidence for review',
  blind: 'hide expected outputs or target labels from the verifier',
};

export const CONTEXT_MODES = Object.freeze(Object.keys(MODE_SEMANTICS));
const MODE_SET = new Set(CONTEXT_MODES);

export function isContextMode(value) {
  return typeof value === 'string' && MODE_SET.has(value);
}

export function assertContextMode(value) {
  if (!isContextMode(value)) {
    throw new TypeError(`unsupported context mode: ${String(value)}`);
  }

  return value;
}

export function contextModeSemantics(value) {
  assertContextMode(value);
  return MODE_SEMANTICS[value];
}
