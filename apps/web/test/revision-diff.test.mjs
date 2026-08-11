import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C10: the Claim revision diff shows field-level changes with authors and long text. */
const source = await readFile(new URL("../app/claims/[claimId]/diff/page.js", import.meta.url), "utf8");

test("diff compares two revisions field by field", () => {
  assert.match(source, /revisions\/\$\{revision\}/);
  assert.match(source, /From revision/);
  assert.match(source, /To revision/);
  assert.match(source, /Changed fields/);
  assert.match(source, /JSON\.stringify\(from\[field\]/);
  assert.match(source, /No differences\./);
});

test("diff surfaces authors and timestamps alongside changes", () => {
  assert.match(source, /createdBy/);
  assert.match(source, /createdAt/);
  assert.match(source, /by \{diff\.from\.createdBy\}/);
  assert.match(source, /tabular-nums/);
});

test("diff renders on the template with recovery for long text", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /whitespace-pre-wrap/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry/);
  assert.match(source, /Skeleton/);
});
