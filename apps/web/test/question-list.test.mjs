import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C04: the Question list makes status and next steps scannable. */
const source = await readFile(new URL("../app/questions/page.js", import.meta.url), "utf8");

test("question list filters by status through the API and searches locally", () => {
  assert.match(source, /questions\?/);
  assert.match(source, /filters\.state/);
  assert.match(source, /filters\.search/);
  assert.match(source, /under_review/);
});

test("question cards expose status and a next-step action in text", () => {
  assert.match(source, /Badge/);
  assert.match(source, /question\.state\.replaceAll\('_', ' '\)/);
  assert.match(source, /nextStep\(question\.state\)/);
  assert.match(source, /Under review/);
  assert.match(source, /Open for research/);
  assert.match(source, /relativeTime/);
});

test("question list keeps the page template and full recovery states", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Skeleton/);
  assert.match(source, /Empty/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry=\{load\}/);
});
