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
  assert.match(page, /className="mx-auto max-w-3xl/);
});
