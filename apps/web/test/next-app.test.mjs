import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('initializes the Next App Router and Cloudflare deployment', async () => {
  const [manifest, layout, config, workerConfig, openNextConfig, icon] = await Promise.all([
    read('../package.json'), read('../app/layout.js'), read('../next.config.mjs'), read('../wrangler.jsonc'), read('../open-next.config.ts'), read('../app/icon.svg'),
  ]);
  const packageJson = JSON.parse(manifest);
  assert.equal(packageJson.scripts.dev, 'next dev');
  assert.match(layout, /<html lang="en"/);
  assert.match(layout, /<TemplateShell>/);
  assert.match(config, /turbopack: \{ root: workspaceRoot \}/);
  assert.match(workerConfig, /"main": "\.open-next\/worker\.js"/);
  assert.match(openNextConfig, /defineCloudflareConfig/);
  assert.match(icon, /The EviMesh branched evidence mark/);
  assert.match(icon, /#2063BF/);
});

test('Kinetic Journal shell exposes the locked publication navigation', async () => {
  const [shell, palette, globals] = await Promise.all([read('../components/template-shell.js'), read('../components/command-palette.js'), read('../app/globals.css')]);
  const entries = [
    ['/home', 'Home'], ['/explore', 'Explore'], ['/work', 'Work'], ['/tools', 'Tools'],
    ['/contributions', 'Contributions'], ['/agent', 'Agent'], ['/docs', 'Docs'],
  ];
  for (const [href, label] of entries) {
    assert.ok(shell.includes(`href: '${href}', label: '${label}'`));
    assert.ok(palette.includes(`label: '${label}'`));
  }
  assert.match(shell, /aria-label="Primary"/);
  assert.match(shell, /aria-label="Primary mobile"/);
  assert.match(shell, /kinetic-page-enter/);
  assert.match(shell, /kinetic-nav-link/);
  assert.match(globals, /kinetic-page-enter 200ms/);
  assert.match(globals, /translateX\(8px\)/);
  assert.match(globals, /\.kinetic-nav-link::after[\s\S]*transition: transform 160ms/);
});

test('local fonts and editorial page primitives are wired without runtime font requests', async () => {
  const [globals, page, provenance] = await Promise.all([
    read('../app/globals.css'), read('../components/ui/page.js'), read('../public/fonts/README.md'),
  ]);
  for (const family of ['Inter Tight', 'Source Serif 4', 'IBM Plex Mono']) assert.match(globals, new RegExp(family));
  assert.match(globals, /url\(["']\/fonts\//);
  assert.match(page, /grid-cols-12/);
  assert.match(page, /max-w-\[96rem\]/);
  assert.match(provenance, /SIL Open Font License 1\.1/);
  assert.doesNotMatch(globals, /https:\/\/fonts\.(?:googleapis|gstatic)\.com/);
});

test('heterogeneous research graph is an interactive client leaf with a simultaneous index', async () => {
  const graph = await read('../components/claim-dag.js');
  assert.match(graph, /^'use client';/);
  assert.match(graph, /from 'd3-dag'/);
  assert.match(graph, /<ReactFlow/);
  assert.match(graph, /Graph \+ Relationship Index/);
  assert.match(graph, /<RelationshipIndex/);
  assert.match(graph, /Open full detail/);
  assert.doesNotMatch(graph, /role="tablist"|Graph\/List/);
});

test('Explore discovers the unified research object set', async () => {
  const explore = await read('../app/explore/page.js');
  for (const endpoint of ['/questions?', '/answers?', '/claims?', '/rebuttals?', '/evaluations?', '/evidence?', '/datasets?', '/tools?', '/runs?']) assert.ok(explore.includes(endpoint), `missing ${endpoint}`);
  assert.match(explore, /Research object facets/);
  assert.match(explore, /Filter by research object type/);
  assert.doesNotMatch(explore, /Topics|Researchers|role="tablist"/);
});

test('typed detail routes share content, provenance and neighborhood rendering', async () => {
  const detail = await read('../components/research-object-detail.js');
  assert.match(detail, /TYPE CONTENT/);
  assert.match(detail, /PROVENANCE MARGINALIA/);
  assert.match(detail, /REVISION/);
  assert.match(detail, /SIGNATURE/);
  assert.match(detail, /PROVENANCE/);
  assert.match(detail, /<ClaimDag direction="both" focusId=\{id\} graph=\{neighborhood\}/);
  for (const route of ['answers/[answerId]', 'rebuttals/[rebuttalId]', 'evaluations/[evaluationId]', 'datasets/[datasetId]', 'tools/[toolId]']) await access(new URL(`../app/${route}/page.js`, import.meta.url));
});

test('research authoring routes are read-only CLI and MCP handoffs', async () => {
  const paths = [
    '../app/questions/new/page.js', '../app/claims/new/page.js', '../app/runs/new/page.js',
    '../app/evidence/new/page.js', '../app/challenges/new/page.js', '../app/verification/receipt/new/page.js',
    '../app/artifacts/upload/page.js',
  ];
  const sources = await Promise.all(paths.map(read));
  for (const source of sources) {
    assert.match(source, /ResearchWriteHandoff/);
    assert.doesNotMatch(source, /useState|<form|method:\s*['"]POST|onSubmit/);
  }
});

test('research surfaces contain no browser mutation controls or competitive meters', async () => {
  const paths = [
    '../components/artifact-upload-panel.js', '../components/verification-receipt-form.js',
    '../components/verification-workspace.js', '../components/research-write-handoff.js',
    '../components/research-object-detail.js', '../app/work/page.js', '../app/projects/page.js',
    '../app/tasks/[taskId]/page.js', '../app/design/page.js',
  ];
  const source = (await Promise.all(paths.map(read))).join('\n');
  assert.doesNotMatch(source, /method:\s*['"]POST|<form|onSubmit|Submit verification|Review and sign|Start Attempt|Create a project/i);
  assert.doesNotMatch(source, /\b(?:scores?|ranked|rankings?|leaderboard|progressbar)\b/i);
});

test('Projects and Task details expose records without direct research mutation', async () => {
  const [projects, task] = await Promise.all([read('../app/projects/page.js'), read('../app/tasks/[taskId]/page.js')]);
  assert.match(projects, /READ-ONLY WEB/);
  assert.match(task, /Attempts begin outside the reading surface/);
  assert.match(task, /HandoffSheet/);
  assert.doesNotMatch(projects + task, /method:\s*['"]POST|Acquire lease|Release my lease|startAttempt/);
});

test('account, token, key and Agent connection controls remain interactive', async () => {
  const [settings, tokens, keys, agent] = await Promise.all([
    read('../app/settings/page.js'), read('../app/settings/tokens/page.js'), read('../app/settings/keys/page.js'), read('../app/agent/page.js'),
  ]);
  assert.match(settings, /Save profile/);
  assert.match(tokens, /Create token/);
  assert.match(keys, /signing-keys/);
  assert.match(agent, /MCP_CONFIG/);
});

test('graph and mobile layout obey touch, overflow and reduced-motion constraints', async () => {
  const [globals, graph, design] = await Promise.all([read('../app/globals.css'), read('../components/claim-dag.js'), read('../app/design/page.js')]);
  assert.match(globals, /html \{[\s\S]*overflow-x:\s*hidden/);
  assert.match(globals, /body \{[\s\S]*overflow-x:\s*hidden/);
  assert.match(globals, /\.dag-canvas \{[\s\S]*overflow:\s*hidden/);
  assert.match(globals, /contain:\s*inline-size layout paint/);
  assert.match(globals, /min-block-size:\s*44px/);
  assert.match(globals, /prefers-reduced-motion:\s*reduce/);
  assert.match(graph, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame/);
  assert.doesNotMatch(design, /<Progress|value=\{60\}/);
});
