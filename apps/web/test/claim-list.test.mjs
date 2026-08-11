import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C08: the Claim list is scannable without relying on color alone. */
const source = await readFile(new URL("../app/claims/page.js", import.meta.url), "utf8");

test("claim list renders status as text badges, not color alone", () => {
  assert.match(source, /Badge/);
  assert.match(source, /claimState\(claim\)\.replaceAll\('_', ' '\)/);
  assert.match(source, /stateVariant/);
  for (const [state, variant] of [
    ["accepted", "success"],
    ["refuted", "destructive"],
    ["under_verification", "warning"],
    ["candidate", "info"],
  ]) {
    assert.match(source, new RegExp(`'${state}'`), `missing ${state} in state map`);
    assert.match(source, new RegExp(`return '${variant}'`), `missing ${variant} variant`);
  }
});

test("claim list keeps the page template and recovery states", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Skeleton/);
  assert.match(source, /Empty/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry=\{load\}/);
});

test("claim list filters by status and tag through the API", () => {
  assert.match(source, /claims\?/);
  assert.match(source, /filters\.status/);
  assert.match(source, /filters\.tag/);
  assert.match(source, /under_verification/);
});

test("claim cards expose scanable metadata rows", () => {
  assert.match(source, /questionId/);
  assert.match(source, /tabular-nums/);
  assert.match(source, /relativeTime/);
});
