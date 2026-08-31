import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

/*
 * Shared-foundation contracts (11-revision-decisions.md §3-§4): one tab form,
 * one rail width, one object-header shape, one provenance fold. These source
 * assertions pin the invariants the visual pass depends on.
 */

test('TabNav is the single underline tab form with 44px touch targets', async () => {
  const tabNav = await read('../components/ui/tab-nav.js');
  assert.match(tabNav, /role="tablist"/);
  assert.match(tabNav, /border-b-2/);
  assert.match(tabNav, /h-11/, 'tab hit targets must be 44px');
  assert.match(tabNav, /overflow-x-auto/);
  assert.match(tabNav, /focus-visible:ring-2 focus-visible:ring-primary/);
  // Counts are navigation entry points, never scores: tabular nums, no percent.
  assert.match(tabNav, /tabular-nums/);
});

test('Rail is the single 18rem sticky right column', async () => {
  const rail = await read('../components/ui/rail.js');
  assert.match(rail, /lg:w-\[18rem\]/);
  assert.match(rail, /lg:sticky/);
  assert.match(rail, /aria-label/);
});

test('ObjectHeader keeps serif scoped and the action slot single-primary', async () => {
  const header = await read('../components/ui/object-header.js');
  // Serif only applies to the statement/title voice, never badges or actions.
  assert.match(header, /claim-statement font-serif/);
  assert.match(header, /max-w-\[65ch\]/);
  assert.match(header, /[Aa]t most one primary action/);
});

test('ProvenanceList keeps hashes one layer down in a fold', async () => {
  const provenance = await read('../components/ui/provenance-list.js');
  assert.match(provenance, /<details/);
  assert.match(provenance, /font-mono text-xs tabular-nums/);
  assert.match(provenance, /'Missing'/);
});

test('PageState provides same-shape skeletons for the three page families', async () => {
  const state = await read('../components/ui/page-state.js');
  for (const shape of ['list', 'detail', 'workspace']) assert.match(state, new RegExp(shape));
  assert.match(state, /aria-busy="true"/);
});

test('layout tokens exist and 390px gutters collapse to 1rem', async () => {
  const css = await read('../app/globals.css');
  assert.match(css, /--evimesh-container-px: 1\.5rem/);
  assert.match(css, /--evimesh-rail-w: 18rem/);
  assert.match(css, /--evimesh-radius-control: 1px/);
  assert.match(css, /--evimesh-radius-surface: 2px/);
  assert.match(css, /--evimesh-radius-overlay: 3px/);
  assert.match(css, /--evimesh-motion-enter: 220ms/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /--evimesh-container-px: 1rem/);
});
