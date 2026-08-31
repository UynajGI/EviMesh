import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('archived prototype keeps graph and index edge ids identical under one filter model', async () => {
  const [html, script] = await Promise.all([
    read('../prototypes/v2.1-kinetic-journal/index.html'),
    read('../prototypes/v2.1-kinetic-journal/prototype.js'),
  ]);
  const graphEdgeIds = [...script.matchAll(/\{ id: '(edge_[^']+)'/g)].map((match) => match[1]).sort();
  const indexEdgeIds = [...html.matchAll(/data-edge-id="([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(graphEdgeIds, indexEdgeIds);
  assert.match(script, /relationshipRows\.forEach/);
  assert.match(script, /row\.hidden = !node \|\| node\.hidden/);
  assert.match(script, /relationGroup\.hidden = row\.hidden/);
  const depthControl = html.match(/<select data-graph-depth>([\s\S]*?)<\/select>/)?.[1] ?? '';
  assert.match(depthControl, /<option>1<\/option>/);
  assert.match(depthControl, /<option selected>2<\/option>/);
  assert.match(depthControl, /<option>3<\/option>/);
  assert.doesNotMatch(depthControl, /<option>4<\/option>/);
});

test('archived prototype component rules consume palette tokens and retain motion fallback', async () => {
  const styles = await read('../prototypes/v2.1-kinetic-journal/styles.css');
  const componentRules = styles.replace(/:root\s*\{[\s\S]*?\}/, '');
  assert.doesNotMatch(componentRules, /#[0-9a-f]{3,8}|rgba?\(|\bcolor:\s*(?:white|black)\b/i);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /--accent-foreground:/);
  assert.match(styles, /--paper-glass:/);
});
