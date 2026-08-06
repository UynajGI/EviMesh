import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('initializes the Next App Router shell', async () => {
  const [manifest, layout, page, config, globals, postcss] = await Promise.all([
    read('../package.json'), read('../app/layout.js'), read('../app/page.js'), read('../next.config.mjs'), read('../app/globals.css'), read('../postcss.config.mjs'),
  ]);
  const packageJson = JSON.parse(manifest);
  assert.equal(packageJson.scripts.dev, 'next dev');
  assert.equal(packageJson.scripts.build, 'next build');
  assert.match(layout, /<html lang="en">/);
  assert.match(layout, /import '\.\/globals\.css';/);
  assert.match(page, /Open distributed scientific network/);
  assert.match(config, /turbopack: \{ root: workspaceRoot \}/);
  assert.match(globals, /@import "tailwindcss"/);
  assert.match(postcss, /'@tailwindcss\/postcss': \{\}/);
  assert.match(page, /className="mx-auto max-w-6xl/);
});

test('configures shadcn-compatible Button, Input, and Dialog components', async () => {
  const [config, button, input, dialog] = await Promise.all([
    read('../components.json'), read('../components/ui/button.js'), read('../components/ui/input.js'), read('../components/ui/dialog.js'),
  ]);
  assert.equal(JSON.parse(config).tailwind.config, '');
  assert.match(button, /export function Button/);
  assert.match(input, /export function Input/);
  assert.match(dialog, /export function DialogContent/);
});

test('defines light and dark design tokens for the web product', async () => {
  const globals = await read('../app/globals.css');
  assert.match(globals, /@theme inline/);
  assert.match(globals, /--color-background: var\(--evimesh-background\)/);
  assert.match(globals, /--color-primary: var\(--evimesh-primary\)/);
  assert.match(globals, /:root \{[\s\S]*--evimesh-background:/);
  assert.match(globals, /@media \(prefers-color-scheme: dark\) \{[\s\S]*--evimesh-background:/);
});

test('provides primary navigation and the five initial product routes', async () => {
  const [layout, nav, projects, tasks, verification, contributions] = await Promise.all([
    read('../app/layout.js'), read('../components/site-nav.js'), read('../app/projects/page.js'), read('../app/tasks/page.js'), read('../app/verification/page.js'), read('../app/contributions/page.js'),
  ]);
  assert.match(layout, /<SiteNav \/>/);
  assert.match(nav, /aria-label="Primary navigation"/);
  for (const href of ['/', '/projects', '/tasks', '/verification', '/contributions']) assert.match(nav, new RegExp(`href: '${href.replace('/', '\\/')}'`));
  for (const page of [projects, tasks, verification, contributions]) assert.match(page, /SectionPlaceholder/);
});

test('renders a recoverable global error state with an API request ID', async () => {
  const errorPage = await read('../app/error.js');
  assert.match(errorPage, /'use client'/);
  assert.match(errorPage, /export function requestIdFrom/);
  assert.match(errorPage, /error\?\.request_id/);
  assert.match(errorPage, /request_id: \{requestId\}/);
  assert.match(errorPage, /onClick=\{reset\}/);
});

test('provides loading skeletons for each main product route', async () => {
  const [skeleton, root, projects, tasks, verification, contributions] = await Promise.all([
    read('../components/page-skeleton.js'), read('../app/loading.js'), read('../app/projects/loading.js'), read('../app/tasks/loading.js'), read('../app/verification/loading.js'), read('../app/contributions/loading.js'),
  ]);
  assert.match(skeleton, /aria-busy="true"/);
  assert.match(skeleton, /animate-pulse/);
  for (const loading of [root, projects, tasks, verification, contributions]) assert.match(loading, /PageSkeleton/);
});

test('provides Supabase email and GitHub authentication from the sign-in page', async () => {
  const [client, page] = await Promise.all([read('../lib/supabase-browser.js'), read('../app/sign-in/page.js')]);
  assert.match(client, /createClient\(url, key\)/);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(page, /signInWithPassword/);
  assert.match(page, /signInWithOAuth\(\{ provider: 'github'/);
  assert.match(page, /Continue with GitHub/);
});

test('renders a reusable Cytoscape Claim DAG component', async () => {
  const [dag, verification] = await Promise.all([read('../components/claim-dag.js'), read('../app/verification/page.js')]);
  assert.match(dag, /import cytoscape from 'cytoscape'/);
  assert.match(dag, /return \(\) => cy\.destroy\(\)/);
  assert.match(dag, /Claim dependency graph/);
  assert.match(verification, /<ClaimDag elements=\{sampleElements\}/);
});

test('edits the authenticated actor profile through the API Edge', async () => {
  const page = await read('../app/settings/page.js');
  assert.match(page, /auth\.getSession/);
  assert.match(page, /NEXT_PUBLIC_EVIMESH_API_URL/);
  assert.match(page, /profileRequest\('\/profile'/);
  assert.match(page, /Save profile/);
});

test('manages API tokens with one-time secret display', async () => {
  const page = await read('../app/settings/tokens/page.js');
  assert.match(page, /call\('\/api-tokens'/);
  assert.match(page, /setSecret\(result\.token\)/);
  assert.match(page, /It cannot be shown again/);
  assert.match(page, /Revoke/);
});

test('renders open questions on the homepage by latest available activity', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /\/questions\?limit=20/);
  assert.match(page, /CLOSED_STATES/);
  assert.match(page, /Open questions/);
  assert.match(page, /Newest activity first/);
});

test('renders only claims awaiting verification on the homepage', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /under_verification/);
  assert.match(page, /provisionally_accepted/);
  assert.match(page, /Claims awaiting verification/);
});

test('renders each project latest frontier on the homepage', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /\/projects\?limit=6/);
  assert.match(page, /frontier\/latest/);
  assert.match(page, /Latest frontiers/);
  assert.match(page, /Frontier #/);
});
