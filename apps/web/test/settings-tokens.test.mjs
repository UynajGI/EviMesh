import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D09: security settings show scopes, one-time secrets, and confirmed revocation. */
const tokens = await readFile(new URL("../app/settings/tokens/page.js", import.meta.url), "utf8");
const profile = await readFile(new URL("../app/settings/page.js", import.meta.url), "utf8");

test("token creation shows the secret exactly once with copy feedback", () => {
  assert.match(tokens, /call\('\/api-tokens'/);
  assert.match(tokens, /setSecret\(result\.token\)/);
  assert.match(tokens, /It cannot be shown again/);
  assert.match(tokens, /Copy token/);
  assert.match(tokens, /navigator\.clipboard\.writeText/);
  assert.match(tokens, /setCopied\(true\)/);
});

test("token scopes are readable and selectable", () => {
  assert.match(tokens, /TOKEN_SCOPES/);
  assert.match(tokens, /profile:read/);
  assert.match(tokens, /project:read/);
  assert.match(tokens, /token\.scopes/);
  assert.match(tokens, /scopes\.includes\(scope\)/);
});

test("revoking a token requires confirmation", () => {
  assert.match(tokens, /Confirm/);
  assert.match(tokens, /revokeTarget/);
  assert.match(tokens, /Revoke this token\?/);
  assert.match(tokens, /destructive/);
  assert.match(tokens, /Revoke/);
});

test("profile settings render on the page template with primitives", () => {
  assert.match(profile, /profileRequest\('\/profile'/);
  assert.match(profile, /Save profile/);
  assert.match(profile, /PageContainer/);
  assert.match(profile, /Label htmlFor="display-name"/);
  assert.match(profile, /role=\{message === 'Profile saved\.' \? 'status' : 'alert'\}/);
});
