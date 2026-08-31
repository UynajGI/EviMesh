import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('v2.1 production surfaces avoid comparative bars and raw visual effects', async () => {
  const [roles, contributor, catalog, dialog, login, frontier] = await Promise.all([
    read('../components/role-directory.js'),
    read('../app/contributors/[actorId]/page.js'),
    read('../app/design/page.js'),
    read('../components/ui/dialog.js'),
    read('../app/login/page.js'),
    read('../app/projects/[projectId]/frontier/[snapshotId]/page.js'),
  ]);

  assert.match(roles, /RoleDirectory/);
  assert.doesNotMatch(roles, /percentage|progress|style=|\* 100|role="img"/i);
  assert.doesNotMatch(`${contributor}\n${catalog}`, /RoleBar|role-bar|distribution bar/i);
  assert.doesNotMatch(dialog, /shadow-(?:md|lg|xl|2xl)/);
  assert.doesNotMatch(login, /linear-gradient|radial-gradient/);
  assert.doesNotMatch(frontier, /bg-(?:emerald|red|amber)-\d+/);
  for (const token of ['status-success', 'status-danger', 'status-warning']) assert.match(frontier, new RegExp(token));
});

test('standalone prototype keeps graph and index edge ids identical under one filter model', async () => {
  const [html, script] = await Promise.all([
    read('../../../output/evimesh-v2.1-kinetic-journal/index.html'),
    read('../../../output/evimesh-v2.1-kinetic-journal/prototype.js'),
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

test('standalone prototype component rules consume palette tokens and retain motion fallback', async () => {
  const styles = await read('../../../output/evimesh-v2.1-kinetic-journal/styles.css');
  const componentRules = styles.replace(/:root\s*\{[\s\S]*?\}/, '');
  assert.doesNotMatch(componentRules, /#[0-9a-f]{3,8}|rgba?\(|\bcolor:\s*(?:white|black)\b/i);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /--accent-foreground:/);
  assert.match(styles, /--paper-glass:/);
});
