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

test("question detail uses the controlled-document template and full recovery states", () => {
  /* Controlled-document grammar (same as the Claim page): breadcrumb, ruled
   * title block with attribution, numbered clauses, margin ledger. */
  assert.match(source, /<Breadcrumb/);
  assert.match(source, /<TitleBlock/);
  assert.match(source, /kind="Question"/);
  assert.match(source, /<ClauseRail clauses=\{clauses\}/);
  assert.match(source, /className="doc-margin"/);
  assert.match(source, /className="ref-row"/);
  assert.match(source, /label: 'Signed by'/);
  assert.match(source, /publisher_actor_id/);
  assert.doesNotMatch(source, /PageContainer|PageHeader|TabNav/);
  assert.match(source, /Skeleton/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry=\{load\}/);
  assert.match(source, /None yet\./);
  assert.doesNotMatch(source, /lucide-react/);
});

test("question detail links tasks and the project in context", () => {
  assert.match(source, /\/tasks\/\$\{task\.taskId\}/);
  assert.match(source, /\/projects\/\$\{question\.projectId\}/);
  assert.match(source, /tasks\.length === 0/);
});
