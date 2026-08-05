import test from "node:test";
import assert from "node:assert/strict";
import {
  assertProjectRole,
  assertProjectVisibility,
  isProjectRole,
  isProjectVisibility,
  PROJECT_ROLES,
  PROJECT_VISIBILITIES,
} from "../src/project-role.mjs";

test("defines the project role and visibility vocabulary", () => {
  assert.deepEqual(PROJECT_ROLES, ["owner", "maintainer", "contributor", "viewer"]);
  assert.deepEqual(PROJECT_VISIBILITIES, ["public", "unlisted", "member-only"]);
  assert.equal(isProjectRole("maintainer"), true);
  assert.equal(isProjectRole("admin"), false);
  assert.equal(isProjectVisibility("member-only"), true);
  assert.equal(isProjectVisibility("private"), false);
});

test("rejects unsupported roles and visibility values", () => {
  assert.throws(() => assertProjectRole("admin"), /unsupported project role/);
  assert.throws(() => assertProjectVisibility("private"), /unsupported project visibility/);
});
