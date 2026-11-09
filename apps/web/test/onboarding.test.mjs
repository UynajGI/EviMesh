import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Public product v1: onboarding is account setup, not a role quiz. It records
 * a public profile and Terms acceptance server-side and never stores the
 * choice only in the browser.
 */
const source = await readFile(new URL("../app/onboarding/page.js", import.meta.url), "utf8");

test("onboarding requires an authenticated session boundary", () => {
  assert.match(source, /AdmissionSessionBoundary/);
  assert.match(source, /returnTo="\/onboarding"/);
});

test("onboarding records profile and terms acceptance through the admission API", () => {
  assert.match(source, /onboarding\.complete\(/);
  assert.match(source, /termsVersion: POLICY_EFFECTIVE_DATE/);
  assert.match(source, /displayName: profile\.displayName\.trim\(\)/);
  assert.match(source, /href="\/terms"/);
  assert.match(source, /href="\/privacy"/);
  assert.match(source, /disabled=\{!accepted \|\| !profile\.displayName\.trim\(\)\}/);
});

test("onboarding never keeps account state only in browser storage", () => {
  assert.doesNotMatch(source, /localStorage/);
  assert.match(source, /createAdmissionClient\(session\)\.onboarding/);
});

test("onboarding renders on the page template with primitives", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Button/);
  assert.match(source, /AdmissionFault/);
  assert.doesNotMatch(source, /slate|indigo|bg-white/);
});
