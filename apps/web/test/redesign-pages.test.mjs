import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('representative Kinetic Journal pages use editorial rules instead of dashboard tiles', async () => {
  const [home, explore, work, tools, contributions] = await Promise.all([
    read('../app/page.js'), read('../app/explore/page.js'), read('../app/work/page.js'), read('../app/tools/page.js'), read('../app/contributions/page.js'),
  ]);
  for (const source of [explore, work, tools, contributions]) {
    assert.match(source, /PageContainer wide/);
    assert.match(source, /grid-cols-12|grid min-w-0/);
    assert.doesNotMatch(source, /gradient|shadow-(?:md|lg|xl|2xl)|KPI|dashboard/i);
  }
  assert.match(home, /Open distributed scientific network/);
  assert.match(explore, /Follow the research, object by object/);
  assert.match(work, /The working record/);
  assert.match(tools, /Methods you can inspect/);
  assert.match(contributions, /Contribution Atlas/);
});

test('Tools is Tool-only and exposes the protocol tool-kind facets', async () => {
  const tools = await read('../app/tools/page.js');
  for (const kind of ['skill', 'method', 'software', 'model', 'workflow']) assert.ok(tools.includes(`'${kind}'`));
  assert.match(tools, /\/tools\?limit=50/);
  assert.doesNotMatch(tools, /datasetId|ToolTrace 24|\/datasets/);
});

test('Explore includes reasoning, resource and execution objects', async () => {
  const explore = await read('../app/explore/page.js');
  for (const type of ['question', 'answer', 'claim', 'rebuttal', 'evaluation', 'evidence', 'dataset', 'tool', 'run']) assert.ok(explore.includes(`type: '${type}'`));
  assert.match(explore, /Filter by research object type/);
});

test('web reads research while Agent, CLI and MCP own authoring', async () => {
  const [handoff, work, task, projects, agent] = await Promise.all([
    read('../components/research-write-handoff.js'), read('../app/work/page.js'), read('../app/tasks/[taskId]/page.js'), read('../app/projects/page.js'), read('../app/agent/page.js'),
  ]);
  assert.match(handoff, /Agents prepare\. Humans sign locally/);
  assert.match(handoff, /CLI or MCP/);
  assert.match(agent, /already signed on the human local device/);
  assert.doesNotMatch(work + task + projects, /method:\s*['"]POST|Review and sign|manual fallback/);
});

test('shared detail presents typed content, provenance and the same neighborhood model', async () => {
  const detail = await read('../components/research-object-detail.js');
  assert.match(detail, /lg:col-span-8/);
  assert.match(detail, /lg:col-span-4/);
  assert.match(detail, /PROVENANCE MARGINALIA/);
  assert.match(detail, /node\.ref\?\.id/);
  assert.match(detail, /\.\.\.graphPayload/);
  assert.match(detail, /Revision signature and provenance summary/);
});
