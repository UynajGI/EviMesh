import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Public product token settings list and revoke Device Authorization tokens. */
const tokens = await readFile(new URL("../app/settings/tokens/page.js", import.meta.url), "utf8");
const profile = await readFile(new URL("../app/settings/page.js", import.meta.url), "utf8");

test("manual token creation is absent and Agent connection is the issuance path", () => {
  assert.match(tokens, /Tokens are issued by an approved Agent connection/);
  assert.match(tokens, /href="\/agent"/);
  assert.doesNotMatch(tokens, /Create a token/);
  assert.doesNotMatch(tokens, /method: 'POST'/);
  assert.doesNotMatch(tokens, /navigator\.clipboard/);
});

test("issued token scopes remain readable but cannot be selected in the browser", () => {
  assert.match(tokens, /token\.scopes/);
  assert.doesNotMatch(tokens, /TOKEN_SCOPES/);
  assert.doesNotMatch(tokens, /Checkbox/);
  assert.doesNotMatch(tokens, /research:sign/);
});

test("revoking a token requires confirmation", () => {
  assert.match(tokens, /Confirm/);
  assert.match(tokens, /revokeTarget/);
  assert.match(tokens, /Revoke this token\?/);
  assert.match(tokens, /destructive/);
  assert.match(tokens, /Revoke/);
});

test("profile settings render on the page template with primitives", () => {
  assert.match(profile, /requestOwnProfile/);
  assert.match(profile, /Save profile/);
  assert.match(profile, /PageContainer/);
  assert.match(profile, /Label htmlFor="display-name"/);
  assert.match(profile, /role=\{message === 'Profile saved\.' \? 'status' : 'alert'\}/);
});
