import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C09: the Claim detail keeps a stable hierarchy of statement, assumptions, and falsification. */
const source = await readFile(new URL("../app/claims/[claimId]/page.js", import.meta.url), "utf8");

test("claim detail keeps the full section hierarchy", () => {
  for (const section of ['statement', 'Scope', 'Falsification conditions', 'Assumptions', 'Revision history']) {
    assert.match(source, new RegExp(section), `missing ${section}`);
  }
  assert.match(source, /currentRevision\.revision/);
  assert.match(source, /statusPolicy\.allowedTransitions/);
});

test("claim detail keeps the relation graph with direction switching", () => {
  assert.match(source, /import \{ ClaimDag \}/);
  assert.match(source, /<ClaimDag elements=\{dagElements\} \/>/);
  assert.match(source, /Claim relation graph/);
  assert.match(source, /direction=\$\{direction\}/);
  assert.match(source, /Upstream/);
  assert.match(source, /Downstream/);
  assert.match(source, /source: edge\.sourceClaimId/);
  assert.match(source, /target: edge\.targetClaimId/);
  assert.match(source, /edge\.path\.at\(-1\)/);
  assert.match(source, /flex min-w-0 items-center gap-2/);
});

test("claim detail renders on the page template with recovery", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /claim-statement/);
  assert.match(source, /Badge/);
  assert.match(source, /Skeleton/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry=\{load\}/);
});
