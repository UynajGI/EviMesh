import test from "node:test";
import assert from "node:assert/strict";
import { assertApiTokenScopes } from "../src/api-token.mjs";
import { assertAdminReason, assertProjectRoleForAction, assertProjectVisible } from "../src/project-authorization.mjs";

test("covers public, member, maintainer, and administrator authorization paths", () => {
  // Public anonymous read: visible without a project membership or token scope.
  assert.equal(assertProjectVisible({ visibility: "public" }), true);

  // Member-only read: anonymous access is denied, membership is accepted.
  assert.throws(() => assertProjectVisible({ visibility: "member-only", isMember: false }), /membership/);
  assert.equal(assertProjectVisible({ visibility: "member-only", isMember: true }), true);

  // Maintainer write: viewer cannot write; maintainer can.
  assert.throws(() => assertProjectRoleForAction({ actorRole: "viewer", requiredRole: "maintainer" }), /insufficient/);
  assert.equal(assertProjectRoleForAction({ actorRole: "maintainer", requiredRole: "maintainer" }), true);
  assert.equal(assertApiTokenScopes({ grantedScopes: ["project:read", "profile:read"], requiredScopes: ["project:read"] }), true);

  // Administrator operation: owner must provide an audit reason.
  assert.throws(() => assertAdminReason({ actorRole: "owner", reason: "" }), /reason is required/);
  assert.equal(assertAdminReason({ actorRole: "owner", reason: "archive abandoned project" }), "archive abandoned project");
});
