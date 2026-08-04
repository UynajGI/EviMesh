const ROLE_SEMANTICS = {
  originator: 'created or originated the research object or question',
  contributor: 'made substantive research or implementation contributions',
  reviewer: 'reviewed scope, method, evidence, or presentation',
  verifier: 'performed a verification procedure or reproduction',
  witness: 'attested to an observation or process without owning the result',
  maintainer: 'maintains protocol, infrastructure, or governed project state',
};

export const CONTRIBUTION_ROLES = Object.freeze(Object.keys(ROLE_SEMANTICS));
const ROLE_SET = new Set(CONTRIBUTION_ROLES);

export function isContributionRole(value) {
  return typeof value === 'string' && ROLE_SET.has(value);
}

export function assertContributionRole(value) {
  if (!isContributionRole(value)) {
    throw new TypeError(`unsupported contribution role: ${String(value)}`);
  }

  return value;
}

export function contributionRoleSemantics(value) {
  assertContributionRole(value);
  return ROLE_SEMANTICS[value];
}
