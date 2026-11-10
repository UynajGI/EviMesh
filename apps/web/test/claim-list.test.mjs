import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C08: the Claim list is scannable without relying on color alone. */
const source = await readFile(new URL("../app/claims/page.js", import.meta.url), "utf8");

test("claim list renders status as text badges, not color alone", async () => {
  // Controlled-document migration: the page-local stateVariant map gave way to
  // the shared StatusBadge, whose protocol map lives in components/ui/data.js.
  const data = await readFile(new URL("../components/ui/data.js", import.meta.url), "utf8");
  assert.match(source, /StatusBadge/);
  assert.match(source, /claimState\(claim\)\.replaceAll\('_', ' '\)/);
  assert.match(source, /'under_verification'/);
  for (const [state, variant] of [
    ["accepted", "status-success"],
    ["refuted", "emphasis-danger"],
    ["under_verification", "status-accent"],
    ["candidate", "status-info"],
  ]) {
    assert.match(data, new RegExp(`${state}: '${variant}'`), `missing ${state} in shared state map`);
  }
  assert.doesNotMatch(source, /rounded-(lg|md|full)/, "claim list uses ruled rows, not cards or pills");
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
