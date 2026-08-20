import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C05: the Question detail makes contract, frontier, and tasks understandable. */
const source = await readFile(new URL("../app/questions/[questionId]/page.js", import.meta.url), "utf8");

test("question detail shows contract, revision, and frontier relationship", () => {
  assert.match(source, /Research scope/);
  assert.match(source, /contract\.revision/);
  assert.match(source, /frontier\/latest/);
  assert.match(source, /Frontier #/);
});

test("question detail keeps the page template and full recovery states", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Skeleton/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry=\{load\}/);
  assert.match(source, /Empty/);
});

test("question detail links tasks and the project in context", () => {
  assert.match(source, /\/tasks\/\$\{task\.taskId\}/);
  assert.match(source, /\/projects\/\$\{question\.projectId\}/);
  assert.match(source, /tasks\.length === 0/);
});
