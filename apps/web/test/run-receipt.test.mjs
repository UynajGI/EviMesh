import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D06: the Run Receipt flow drafts locally and validates before preview. */
const source = await readFile(new URL("../app/runs/new/page.js", import.meta.url), "utf8");

test("run receipt covers environment, command, seed, and artifact flow", () => {
  assert.match(source, /Run Receipt/);
  assert.match(source, /environment/);
  assert.match(source, /command/);
  assert.match(source, /randomSeed/);
  assert.match(source, /inputArtifactIds/);
  assert.match(source, /outputArtifactIds/);
  assert.match(source, /networkAccess/);
  assert.match(source, /Preview Receipt/);
});

test("run receipt validates required fields and time ordering", () => {
  assert.match(source, /are required\./);
  assert.match(source, /End time must be after start time\./);
  assert.match(source, /JSON\.parse/);
  assert.match(source, /Alert variant="destructive"/);
});

test("run receipt drafts locally and restores on refresh", () => {
  assert.match(source, /DRAFT_KEY/);
  assert.match(source, /localStorage/);
  assert.match(source, /Draft restored from this browser\./);
  assert.match(source, /Draft saved locally\./);
  assert.match(source, /role="status"/);
});

test("run receipt renders on the page template with form primitives", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Textarea/);
  assert.match(source, /Checkbox/);
  assert.match(source, /Label htmlFor=/);
  assert.doesNotMatch(source, /slate|indigo|bg-white/);
});
