import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('theme contract supports manual overrides and system fallback before first paint', async () => {
  const [layout, toggle, css] = await Promise.all([
    read('../app/layout.js'),
    read('../components/theme-toggle.js'),
    read('../app/globals.css'),
  ]);

  assert.match(layout, /localStorage\.getItem\("evimesh-theme"\)/);
  assert.match(layout, /setAttribute\("data-theme",t\)/);
  assert.match(layout, /t!=="light"&&t!=="dark"/);
  assert.match(toggle, /prefers-color-scheme: dark/);
  assert.match(toggle, /localStorage\.setItem\(STORAGE_KEY, value\)/);
  assert.match(toggle, /data-theme/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /prefers-color-scheme: dark/);
});
