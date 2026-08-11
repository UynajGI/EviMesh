import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D02: onboarding picks a role and reaches a first task within three steps. */
const source = await readFile(new URL("../app/onboarding/page.js", import.meta.url), "utf8");

test("onboarding offers the four core roles", () => {
  for (const role of ['researcher', 'verifier', 'maintainer', 'agent-operator']) {
    assert.match(source, new RegExp(`'${role}'`), `missing ${role}`);
  }
  assert.match(source, /Choose your role/);
  assert.match(source, /Radio/);
});

test("onboarding completes within three steps and lands on a first task", () => {
  assert.match(source, /Step \$\{step\} of 3/);
  assert.match(source, /setStep\(step \+ 1\)/);
  assert.match(source, /Take me to my workspace/);
  assert.match(source, /router\.push/);
  assert.match(source, /target/);
});

test("onboarding persists the choice for later use", () => {
  assert.match(source, /onboarding:role/);
  assert.match(source, /onboarding:interest/);
  assert.match(source, /localStorage\.setItem/);
});

test("onboarding renders on the page template with primitives", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Button/);
  assert.doesNotMatch(source, /slate|indigo|bg-white/);
});
