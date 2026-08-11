import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D08: the Challenge flow states target, basis, impact, and result. */
const source = await readFile(new URL("../app/challenges/new/page.js", import.meta.url), "utf8");

test("challenge locks a target revision with counterexample basis", () => {
  assert.match(source, /Challenge a claim/);
  assert.match(source, /claimRevision/);
  assert.match(source, /counterexampleEvidenceId/);
  assert.match(source, /Rationale/);
  assert.match(source, /requestedOutcome/);
});

test("challenge states impact scope and risk before submission", () => {
  assert.match(source, /impactScope/);
  assert.match(source, /Impact scope/);
  assert.match(source, /blast radius/);
  assert.match(source, /Before you challenge/);
  assert.match(source, /adversarial by design/);
  assert.match(source, /Alert variant="warning"/);
});

test("challenge previews and reports the submission result", () => {
  assert.match(source, /Challenge preview/);
  assert.match(source, /Back to edit/);
  assert.match(source, /Submit challenge/);
  assert.match(source, /Challenge submitted/);
  assert.match(source, /queued for review/);
  assert.match(source, /Alert variant="success"/);
});

test("challenge renders on the page template with primitives only", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Textarea/);
  assert.match(source, /Label htmlFor=/);
  assert.doesNotMatch(source, /slate|indigo|bg-white/);
});
