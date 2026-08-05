import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAdminReason,
  assertProjectRoleForAction,
  assertProjectVisible,
  ProjectAuthorizationError,
} from "../src/project-authorization.mjs";

test("allows role-ranked project actions and rejects insufficient roles", () => {
  assert.equal(assertProjectRoleForAction({ actorRole: "maintainer", requiredRole: "contributor" }), true);
  assert.throws(
    () => assertProjectRoleForAction({ actorRole: "viewer", requiredRole: "contributor" }),
    (error) => error instanceof ProjectAuthorizationError && error.code === "PROJECT_FORBIDDEN",
  );
  assert.throws(() => assertProjectRoleForAction({ actorRole: null }), /PROJECT_ROLE_INVALID|project role/);
});

test("enforces project visibility and administrator reasons", () => {
  assert.equal(assertProjectVisible({ visibility: "public" }), true);
  assert.equal(assertProjectVisible({ visibility: "unlisted" }), true);
  assert.throws(() => assertProjectVisible({ visibility: "member-only", isMember: false }), /membership/);
  assert.equal(assertProjectVisible({ visibility: "member-only", isMember: true }), true);
  assert.equal(assertAdminReason({ actorRole: "owner", reason: "remove compromised member" }), "remove compromised member");
  assert.throws(
    () => assertAdminReason({ actorRole: "owner", reason: "  " }),
    (error) => error instanceof ProjectAuthorizationError && error.code === "ADMIN_REASON_REQUIRED",
  );
});
