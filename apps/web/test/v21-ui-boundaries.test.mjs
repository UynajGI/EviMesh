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
