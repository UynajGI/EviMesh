import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

/*
 * Theme contract (11-revision-decisions.md §4.7): one dark token block. The
 * layout bootstrap resolves "auto" to a concrete value before first paint and
 * re-resolves on system changes; the stylesheet carries a single
 * [data-theme="dark"] block with no prefers-color-scheme duplicate.
 */
test('theme contract supports manual overrides and system fallback before first paint', async () => {
  const [layout, toggle, css] = await Promise.all([
    read('../app/layout.js'),
    read('../components/theme-toggle.js'),
    read('../app/globals.css'),
  ]);

  // Bootstrap: read storage, fall back to the concrete system value, apply
  // before first paint, and re-resolve when the system preference flips while
  // the stored choice is still "auto".
  assert.match(layout, /localStorage\.getItem\("evimesh-theme"\)/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(layout, /addEventListener\("change"/);
  assert.match(layout, /setAttribute\("data-theme",t\)/);
  assert.match(layout, /t!=="light"&&t!=="dark"/);
  // Toggle: flips the attribute, persists, and stays in sync with system flips.
  assert.match(toggle, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(toggle, /localStorage\.setItem\(STORAGE_KEY, value\)/);
  assert.match(toggle, /data-theme/);
  // Stylesheet: exactly one dark token block, no duplicate.
  assert.match(css, /\[data-theme="dark"\]/);
  assert.equal(css.includes('prefers-color-scheme: dark'), false, 'duplicate system-dark token block must stay removed');
});
