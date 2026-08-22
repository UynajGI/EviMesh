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
  assert.match(source, /background: color\.background, color: color\.foreground/);
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

test("graph layout endpoints stay separate from protocol render and list endpoints", () => {
  assert.match(source, /layoutSource: element\.data\.layoutSource \?\? element\.data\.source/);
  assert.match(source, /layoutTarget: element\.data\.layoutTarget \?\? element\.data\.target/);
  assert.match(source, /edge\.layoutTarget === node\.id/);
  assert.match(source, /byId\.has\(edge\.layoutSource\)/);
  assert.match(source, /source: edge\.source/);
  assert.match(source, /target: edge\.target/);
});

test("graph edge families follow the design color and line language", () => {
  assert.match(source, /reproduces: 'positive'/);
  assert.match(source, /supersedes: 'lineage'/);
  assert.match(source, /positive: Object\.freeze\(\{ label: 'supports \/ reproduces \/ verifies', strokeDasharray: 'none', strokeWidth: 1\.5 \}\)/);
  assert.match(source, /negative: Object\.freeze\(\{ label: 'refutes \/ contradicts \/ challenges', strokeDasharray: 'none', strokeWidth: 2 \}\)/);
  assert.match(source, /qualify: Object\.freeze\(\{ label: 'qualifies', strokeDasharray: '6 4', strokeWidth: 1\.5 \}\)/);
  assert.match(source, /structural: Object\.freeze\(\{ label: 'depends on \/ uses \/ implements', strokeDasharray: '2 3', strokeWidth: 1\.5 \}\)/);
  assert.match(source, /lineage: Object\.freeze\(\{ label: 'extends \/ supersedes \/ derived from', strokeDasharray: '10 3 2 3', strokeWidth: 1\.5 \}\)/);
});

test("graph canvas and legend render the shared family line styles", () => {
  assert.match(source, /const edgeStyle = edgeStyleFor\(family\)/);
  assert.match(source, /const edgeColor = `var\(--evimesh-dag-\$\{family\}, var\(--evimesh-border\)\)`/);
  assert.match(source, /strokeDasharray: edgeStyle\.strokeDasharray/);
  assert.match(source, /strokeWidth: edgeStyle\.strokeWidth/);
  assert.match(source, /Object\.entries\(EDGE_FAMILY_STYLES\)/);
  assert.match(source, /<span aria-hidden="true" className="inline-flex items-center gap-0">/);
  assert.match(source, /<line/);
  assert.match(source, /<span style=\{\{ color: edgeColor \}\}>→<\/span>/);
  assert.match(source, /\{edgeStyle\.label\}/);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i, "edge styles must keep using semantic color tokens");
});

test("graph edges use React Flow closed target arrows with their family color", () => {
  assert.match(source, /Background, Controls, MarkerType, ReactFlow/);
  assert.match(source, /markerEnd: \{ type: MarkerType\.ArrowClosed, color: edgeColor \}/);
  assert.match(source, /stroke: edgeColor/);
  assert.match(source, /source: edge\.source/);
  assert.match(source, /target: edge\.target/);
});
