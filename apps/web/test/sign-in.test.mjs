import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D01: the sign-in page covers both entries, loading, and privacy. */
const source = await readFile(new URL("../app/sign-in/page.js", import.meta.url), "utf8");

test("sign-in offers email and GitHub entries with loading", () => {
  assert.match(source, /signInWithPassword/);
  assert.match(source, /signInWithOAuth\(\{ provider: 'github'/);
  assert.match(source, /Continue with GitHub/);
  assert.match(source, /loading=\{pending\}/);
});

test("sign-in states the return path and privacy handling", () => {
  assert.match(source, /return to the page you were viewing/);
  assert.match(source, /Supabase Auth/);
  assert.match(source, /never stores your password/);
});

test("sign-in renders on the page template with form primitives", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /Label htmlFor="email"/);
  assert.match(source, /Label htmlFor="password"/);
  assert.match(source, /role=\{message === 'Signed in successfully\.' \? 'status' : 'alert'\}/);
});
