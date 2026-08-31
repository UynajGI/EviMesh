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
  assert.match(source, /<ClaimDag direction=\{direction\} focusId=\{claim\.claimId\} graph=\{dagGraph\}/);
  assert.match(source, /graph\?direction=\$\{value\}/);
  assert.match(source, /const source = edge\.sourceNodeId/);
  assert.match(source, /const target = edge\.targetNodeId/);
  // The keyboard-reachable Relationship Index lives beside the graph and is
  // driven by the same typed nodes and edges.
  assert.match(source, /dagGraph/);
  assert.match(source, /graph\?\.truncated/);
  assert.match(source, /Neighborhood truncated/);
  assert.match(source, /originatorContributions/);
  assert.match(source, /drafted by agent/);
  assert.match(source, /signed by human/);
  assert.match(source, /actorHref\(draftingContribution\.actorId, 'agent'\)/);
  assert.match(source, /actorHref\(draftingContribution\.signedBy, 'human'\)/);
  assert.match(source, /onDirectionChange=\{setDirection\}/);
});

test("claim detail renders on the page template with recovery", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /serif\n?\s*statement=\{currentRevision\.statement\}/);
  assert.match(source, /Badge/);
  assert.match(source, /Skeleton/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry=\{load\}/);
});
