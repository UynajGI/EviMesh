import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, styles] = await Promise.all([
  readFile(new URL('../components/claim-dag.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/globals.css', import.meta.url), 'utf8'),
]);

test('research neighborhood keeps graph and Relationship Index visible together', () => {
  assert.match(source, /Graph \+ Relationship Index/);
  assert.match(source, /<GraphCanvas/);
  assert.match(source, /<RelationshipIndex/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 7fr\) minmax\(20rem, 5fr\)/);
  assert.doesNotMatch(source, /role="tablist"|setView\(|Graph\/List/);
});

test('graph remains interactive and list-equivalent through a shared model', () => {
  for (const token of ['ReactFlow', 'd3-dag', 'panOnDrag', 'zoomOnPinch', 'nodesDraggable', 'requestFullscreen', 'fitView', 'relationshipsForSelection']) assert.match(source, new RegExp(token));
  assert.match(source, /Upstream/);
  assert.match(source, /Downstream/);
  assert.match(source, /All visible objects/);
  assert.match(source, /Open full detail/);
});

test('nodes expose family shape, Lucide icon, type and revision text', () => {
  assert.match(source, /FAMILY_ICONS/);
  assert.match(source, /data-node-family/);
  assert.match(source, /data-node-kind/);
  assert.match(source, /item\.node\.id\}@r\{item\.node\.revision/);
  for (const family of ['structure', 'reasoning', 'resource', 'execution', 'verification']) assert.match(styles, new RegExp(`data-node-family="${family}"`));
});

test('selection path and filters preserve motion and accessibility constraints', () => {
  assert.match(source, /dag-edge--selected-path/);
  assert.match(source, /\[1, 2, 3\]/);
  assert.doesNotMatch(source, /\[1, 2, 3, 4\]/);
  assert.match(styles, /stroke 160ms/);
  assert.match(styles, /min-block-size:\s*44px/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /matchMedia\(query\)/);
  assert.match(source, /reducedMotion \? 0 : 2(?:60|80)/);
});
