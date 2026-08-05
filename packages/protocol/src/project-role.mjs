export const PROJECT_ROLES = Object.freeze(["owner", "maintainer", "contributor", "viewer"]);
const PROJECT_ROLE_SET = new Set(PROJECT_ROLES);

export const PROJECT_VISIBILITIES = Object.freeze(["public", "unlisted", "member-only"]);
const PROJECT_VISIBILITY_SET = new Set(PROJECT_VISIBILITIES);

export function isProjectRole(value) {
  return typeof value === "string" && PROJECT_ROLE_SET.has(value);
}

export function assertProjectRole(value) {
  if (!isProjectRole(value)) throw new TypeError(`unsupported project role: ${String(value)}`);
  return value;
}

export function isProjectVisibility(value) {
  return typeof value === "string" && PROJECT_VISIBILITY_SET.has(value);
}

export function assertProjectVisibility(value) {
  if (!isProjectVisibility(value)) throw new TypeError(`unsupported project visibility: ${String(value)}`);
  return value;
}
