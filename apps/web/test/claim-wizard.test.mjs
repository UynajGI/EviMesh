import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D04: the Claim wizard steps through statement, structure, and preview. */
const source = await readFile(new URL("../app/claims/new/page.js", import.meta.url), "utf8");

test("claim wizard steps through statement, structure, and preview", () => {
  assert.match(source, /Step \$\{step\} of 3/);
  assert.match(source, /Structure the claim/);
  assert.match(source, /Preview Claim/);
  assert.match(source, /setStep\(2\)/);
  assert.match(source, /setStep\(3\)/);
  for (const field of ['Statement', 'Scope', 'Assumptions', 'Falsification conditions']) assert.match(source, new RegExp(field));
});

test("claim wizard carries the parent relationship", () => {
  assert.match(source, /parentClaimId/);
  assert.match(source, /Parent claim/);
  assert.match(source, /builds on/);
});

test("claim wizard keeps drafts, bundles, and recovery", () => {
  assert.match(source, /loadDraft\(DRAFT_KEY, INITIAL\)/);
  assert.match(source, /saveDraft\(DRAFT_KEY, form\)/);
  assert.match(source, /Draft restored from this browser/);
  assert.match(source, /downloadDraftBundle\(form, 'json'\)/);
  assert.match(source, /downloadDraftBundle\(form, 'zip'\)/);
  assert.match(source, /role="alert"/);
  assert.match(source, /JSON field is invalid/);
});

test("claim wizard renders on the page template with form primitives", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Textarea/);
  assert.match(source, /Label htmlFor=/);
  assert.doesNotMatch(source, /slate|indigo|bg-white/);
});
