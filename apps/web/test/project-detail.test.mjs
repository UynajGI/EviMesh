import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C03: the Project workspace switches context between its sections. */
const source = await readFile(new URL("../app/projects/[projectId]/page.js", import.meta.url), "utf8");

test("project workspace offers in-context section switching", () => {
  for (const name of ['Overview', 'Questions', 'Tasks', 'Claims', 'Frontier', 'Activity']) {
    assert.match(source, new RegExp(`'${name}'`), `missing ${name} tab`);
  }
  assert.match(source, /tab === 'Overview'/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /setTab\(/);
});

test("project workspace loads each section from the API", () => {
  assert.match(source, /\/projects\/\$\{projectId\}/);
  assert.match(source, /\/questions\?projectId=/);
  assert.match(source, /\/tasks\?projectId=/);
  assert.match(source, /\/claims\?projectId=/);
  assert.match(source, /frontier\/latest/);
});

test("project workspace keeps the page template and recovery states", () => {
  assert.match(source, /PageContainer/);
  assert.match(source, /PageHeader/);
  assert.match(source, /Skeleton/);
  assert.match(source, /ErrorState/);
  assert.match(source, /onRetry=\{load\}/);
  assert.match(source, /FrontierTimeline/);
  assert.match(source, /ProjectEventStream/);
});
