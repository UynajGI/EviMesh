import {
  assertProjectRole,
  assertProjectVisibility,
  PROJECT_ROLES,
} from "../../protocol/src/project-role.mjs";

const ROLE_RANK = Object.freeze(Object.fromEntries(PROJECT_ROLES.map((role, index) => [role, PROJECT_ROLES.length - index])));

export class ProjectAuthorizationError extends Error {
  constructor(message, code = "PROJECT_FORBIDDEN") {
    super(message);
    this.name = "ProjectAuthorizationError";
    this.code = code;
  }
}

/** Require the authenticated Actor's project role to meet the minimum role. */
export function assertProjectRoleForAction({ actorRole, requiredRole = "viewer" } = {}) {
  try {
    assertProjectRole(actorRole);
    assertProjectRole(requiredRole);
  } catch (error) {
    throw new ProjectAuthorizationError(error.message, "PROJECT_ROLE_INVALID");
  }
  if (ROLE_RANK[actorRole] < ROLE_RANK[requiredRole]) {
    throw new ProjectAuthorizationError("project role is insufficient");
  }
  return true;
}

/** Public and unlisted projects are readable without membership; member-only is not. */
export function assertProjectVisible({ visibility, isMember = false } = {}) {
  try {
    assertProjectVisibility(visibility);
  } catch (error) {
    throw new ProjectAuthorizationError(error.message, "PROJECT_VISIBILITY_INVALID");
  }
  if (visibility === "member-only" && isMember !== true) {
    throw new ProjectAuthorizationError("project membership is required");
  }
  return true;
}

/** High-privilege project operations must include an auditable reason. */
export function assertAdminReason({ actorRole, reason } = {}) {
  assertProjectRoleForAction({ actorRole, requiredRole: "owner" });
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new ProjectAuthorizationError("admin reason is required", "ADMIN_REASON_REQUIRED");
  }
  return reason.trim();
}
