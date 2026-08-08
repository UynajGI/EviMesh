import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C07: the Task detail keeps inputs, outputs, acceptance, and actions in one view. */
const source = await readFile(new URL("../app/tasks/[taskId]/page.js", import.meta.url), "utf8");

test("task detail keeps all sections and actions on one screen", () => {
  for (const section of ['Inputs', 'Outputs', 'Acceptance', 'Dependencies', 'Leases']) {
    assert.match(source, new RegExp(section), `missing ${section}`);
  }
  assert.match(source, /Start Attempt/);
  assert.match(source, /Acquire lease/);
  assert.match(source, /Release my lease/);
  assert.match(source, /Download Context bundle/);
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

test("task detail carries recovery for data and actions", () => {
  assert.match(source, /onRetry=\{reload\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /loading=\{actionPending\}/);
  assert.match(source, /loading=\{leasePending\}/);
});
