const SEVERITY_SEMANTICS = {
  critical: 'blocks acceptance because the result or safety is invalid',
  major: 'is a material issue that blocks progression until addressed',
  warning: 'is a non-blocking risk or limitation that must remain visible',
  note: 'is informational context without a blocking effect',
};

export const FINDING_SEVERITIES = Object.freeze(Object.keys(SEVERITY_SEMANTICS));
const SEVERITY_SET = new Set(FINDING_SEVERITIES);

export function isFindingSeverity(value) {
  return typeof value === 'string' && SEVERITY_SET.has(value);
}

export function assertFindingSeverity(value) {
  if (!isFindingSeverity(value)) {
    throw new TypeError(`unsupported finding severity: ${String(value)}`);
  }

  return value;
}

export function findingSeveritySemantics(value) {
  assertFindingSeverity(value);
  return SEVERITY_SEMANTICS[value];
}
