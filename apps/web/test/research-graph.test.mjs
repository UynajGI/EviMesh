import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C11: the research graph offers a keyboard-accessible list alternative. */
const source = await readFile(new URL("../components/claim-dag.js", import.meta.url), "utf8");

test("graph keeps the canvas, legend, and node details", () => {
  assert.match(source, /aria-label="Claim relation graph"/);
  assert.match(source, /aria-label="Claim node details"/);
  assert.match(source, /aria-label="Claim state legend"/);
  assert.match(source, /CLAIM_STATE_COLORS/);
  assert.match(source, /React Flow/);
});

test("graph offers a list alternative for keyboard access", () => {
  assert.match(source, /aria-label="Claim graph list view"/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /setView\('list'\)/);
  assert.match(source, /ClaimDagList/);
  assert.match(source, /Nodes/);
  assert.match(source, /Edges/);
});

test("graph filters nodes and edges by state", () => {
  assert.match(source, /stateFilter/);
  assert.match(source, /Filter by state/);
  assert.match(source, /visibleNodeIds/);
  assert.match(source, /visibleNodeIds\.has\(node\.id\)/);
});

test("graph list rows carry text labels, not color alone", () => {
  assert.match(source, /node\.state \?\? 'unknown'/);
  assert.match(source, /Badge/);
  assert.match(source, /edge\.source/);
  assert.match(source, /edge\.target/);
  assert.match(source, /edge\.relation/);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i, "graph colors must come from semantic tokens");
});

test("graph edge families follow the design color language", () => {
  assert.match(source, /reproduces: 'positive'/);
  assert.match(source, /supersedes: 'lineage'/);
  assert.match(source, /\['positive', 'supports \/ reproduces \/ verifies'\]/);
  assert.match(source, /\['lineage', 'extends \/ supersedes \/ derived from'\]/);
});
