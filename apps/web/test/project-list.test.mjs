import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C02: the Project list supports search, filter, status, activity, and empty states. */
const source = await readFile(new URL("../app/projects/page.js", import.meta.url), "utf8");

test("project list filters by status through the API and searches locally", () => {
  assert.match(source, /projects\?/);
  assert.match(source, /filters\.state/);
  assert.match(source, /filters\.search/);
  assert.match(source, /toLowerCase\(\)\.includes\(query\)/);
});

test("project cards expose status and activity as scannable text", () => {
  assert.match(source, /Badge/);
  assert.match(source, /project\.state\.replaceAll\('_', ' '\)/);
  assert.match(source, /relativeTime/);
  assert.match(source, /tabular-nums/);
});

test("project list keeps the page template and full recovery states", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Skeleton/);
  assert.match(source, /Empty/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry=\{load\}/);
});

test("project list exposes an Agent handoff without browser research writes", () => {
  assert.match(source, /READ-ONLY WEB/);
  assert.match(source, /Open Agent connection/);
  assert.doesNotMatch(source, /method:\s*['"]POST|Create a project|Textarea|onSubmit/);
});
