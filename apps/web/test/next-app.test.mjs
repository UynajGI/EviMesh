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
