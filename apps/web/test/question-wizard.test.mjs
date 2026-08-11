import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D03: the Question wizard steps, drafts, previews, and recovers. */
const source = await readFile(new URL("../app/questions/new/page.js", import.meta.url), "utf8");

test("wizard walks four steps with explicit next actions", () => {
  assert.match(source, /Step \$\{step\} of 4/);
  assert.match(source, /Continue to scope/);
  assert.match(source, /Continue to progress/);
  assert.match(source, /Continue to permissions/);
  assert.match(source, /Review question/);
  assert.match(source, /advance\(event, 2\)/);
  assert.match(source, /advance\(event, 3\)/);
  assert.match(source, /advance\(event, 4\)/);
});

test("wizard previews the normalized object before submission", () => {
  assert.match(source, /Normalized question object/);
  assert.match(source, /JSON\.stringify\(draft/);
  assert.match(source, /Back to edit/);
  assert.match(source, /Submit question/);
  assert.match(source, /router\.push\(`\/questions\/\$\{body\.question\.questionId\}`\)/);
});

test("wizard renders on the page template with form primitives only", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Textarea/);
  assert.match(source, /Label htmlFor=/);
  assert.match(source, /role="alert"/);
  assert.match(source, /role="status"/);
  assert.doesNotMatch(source, /slate|indigo|bg-white/);
});
