import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

/*
 * M13.8 redesign contracts (docs/design/05-core-ui-spec.md). These freeze the
 * landing / home / explore / work content rules and the manual-theme plumbing.
 */

test('landing does exactly its four jobs: positioning, example, two paths, trust', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /Make every research step traceable/);
  assert.match(page, /Open distributed scientific network/);
  assert.match(page, /href="\/agent"/);
  assert.match(page, /Connect your agent/);
  assert.match(page, /href="\/explore"/);
  assert.match(page, /Explore research/);
  assert.match(page, /What a research question looks like here/);
  assert.match(page, /Where the trust comes from/);
  for (const trust of ['Verified research identity', 'Immutable revisions', 'signed event chain', 'Shareable permanent links']) {
    assert.match(page, new RegExp(trust));
  }
});

test('landing never fakes live data or sells a score', async () => {
  const page = await read('../app/page.js');
  assert.match(page, /Counts are entry points, never scores/);
  assert.doesNotMatch(page, /support score|truth score|percentage of support/i);
});

test('home renders attention-tiered sections with status badges and copyable ids', async () => {
  const page = await read('../app/home/page.js');
  assert.match(page, /attention priority, never the truth/);
  assert.match(page, /StatusBadge/);
  assert.match(page, /IdChip/);
  for (const section of ['Open questions', 'Claims awaiting verification', 'Latest frontiers', 'Newcomer tasks']) {
    assert.match(page, new RegExp(section));
  }
});

test('explore is one search surface with type filters and honest ordering', async () => {
  const page = await read('../app/explore/page.js');
  assert.match(page, /aria-label="Search research"/);
  assert.match(page, /Object types are filters here, not navigation/);
  for (const label of ['Questions', 'Projects', 'Claims']) {
    assert.match(page, new RegExp(`label: '${label}'`));
  }
  assert.match(page, /role="tablist"/);
  assert.match(page, /Clear filters/);
  assert.match(page, /Sorting never expresses research value or support/);
  assert.match(page, /ErrorState/);
  assert.match(page, /Skeleton/);
});

test('work keeps every write workflow one click away', async () => {
  const page = await read('../app/work/page.js');
  for (const href of ['/questions/new', '/claims/new', '/evidence/new', '/challenges/new', '/runs/new', '/verification/receipt/new']) {
    assert.ok(page.includes(`href: '${href}'`), `Work page is missing ${href}`);
  }
  for (const link of ['/tasks', '/verification', '/contributions', '/events']) {
    assert.ok(page.includes(`href="${link}"`), `Work page is missing ${link}`);
  }
  assert.match(page, /never a score/);
  assert.match(page, /never points or rankings/);
});

test('status badges map protocol states onto dual-tier variants, text first', async () => {
  const data = await read('../components/ui/data.js');
  assert.match(data, /resolveStatusVariant/);
  for (const pair of [
    "refuted: 'emphasis-danger'",
    "contested: 'status-warning'",
    "under_verification: 'status-accent'",
    "provisionally_accepted: 'status-success'",
    "supports: 'status-success'",
    "refutes: 'status-danger'",
    "qualifies: 'status-warning'",
    "reproduces: 'status-info'",
    "critical: 'emphasis-danger'",
    "attention: 'status-warning'",
  ]) {
    assert.ok(data.includes(pair), `status map is missing ${pair}`);
  }
  // Emphasis stays rare: only refuted and upheld claim-challenge states use it.
  const emphasisStates = [...data.matchAll(/(\w+): 'emphasis-[^']+'/g)].map((m) => m[1]);
  assert.deepEqual([...emphasisStates].sort(), ['critical', 'refuted', 'upheld']);
});

test('IdChip truncates ids, keeps the full value copyable, and gives feedback', async () => {
  const chip = await read('../components/ui/idchip.js');
  assert.match(chip, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(chip, /title=\{value\}/);
  assert.match(chip, /aria-label=\{copied === true \? 'Copied'/);
  assert.match(chip, /tabular-nums/);
});

test('manual theme toggle persists and the layout applies it before first paint', async () => {
  const [toggle, layout, globals] = await Promise.all([
    read('../components/theme-toggle.js'),
    read('../app/layout.js'),
    read('../app/globals.css'),
  ]);
  assert.match(toggle, /localStorage.setItem\(STORAGE_KEY/);
  assert.match(toggle, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(toggle, /setAttribute\('data-theme', value\)/);
  assert.match(layout, /localStorage.getItem\("evimesh-theme"\)/);
  assert.match(layout, /data-theme="auto"/);
  assert.match(globals, /\[data-theme="dark"\] \{/);
  assert.match(globals, /:root:not\(\[data-theme="light"\]\) \{/);
});
