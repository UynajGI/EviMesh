import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C07: the Task detail keeps inputs, outputs, acceptance, and actions in one view. */
const source = await readFile(new URL("../app/tasks/[taskId]/page.js", import.meta.url), "utf8");

test("task detail keeps all read-only sections on one screen", () => {
  for (const section of ['Inputs', 'Outputs', 'Acceptance', 'Dependencies', 'Leases']) {
    assert.match(source, new RegExp(section), `missing ${section}`);
  }
  assert.match(source, /Attempts begin outside the reading surface/);
  assert.match(source, /Open Agent handoff/);
  assert.doesNotMatch(source, /method:\s*['"]POST|Acquire lease|Release my lease|startAttempt/);
});

test("task detail renders on the page template with primitives", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Badge/);
  assert.match(source, /Button/);
  assert.match(source, /Skeleton/);
  assert.match(source, /ErrorState/);
  assert.match(source, /Empty/);
});

test("task detail carries recovery for reads and delegates writes", () => {
  assert.match(source, /onRetry=\{reload\}/);
  assert.match(source, /HandoffSheet/);
  assert.match(source, /sq attempt start/);
});
