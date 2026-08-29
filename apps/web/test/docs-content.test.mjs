import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDocsManifest, loadDocsPage } from '../lib/docs-content.mjs';

test('every docs page has whitelisted frontmatter and a unique slug', async () => {
  const { pages } = await loadDocsManifest();
  assert.ok(pages.length >= 10, `expected a real P0 set, found ${pages.length}`);
  const slugs = new Set(pages.map((page) => page.slug));
  assert.equal(slugs.size, pages.length, 'doc slugs must be unique');
  for (const page of pages) {
    assert.ok(page.title, `${page.slug} is missing a title`);
    assert.ok(page.audience, `${page.slug} is missing an audience`);
    assert.equal(page.status === 'current' || page.status === 'draft', true, `${page.slug} has an unknown status`);
    for (const block of page.blocks) assert.ok(block.type, `${page.slug} has a malformed block`);
  }
});

test('the manifest groups pages into fixed sections in IA order', async () => {
  const { sections } = await loadDocsManifest();
  assert.deepEqual(sections.map((section) => section.id), ['getting-started', 'concepts', 'reference']);
  for (const section of sections) {
    for (const page of section.pages) assert.ok(section.slugs.includes(page.slug));
  }
});

test('loadDocsPage resolves one page with prev/next neighbors', async () => {
  const page = await loadDocsPage('getting-started/researcher');
  assert.equal(page.title, 'Researcher quickstart');
  assert.equal(page.audience, 'researcher');
  assert.ok(page.next, 'researcher quickstart should have a next page');
  const missing = await loadDocsPage('no/such-page');
  assert.equal(missing, null);
});

test('concepts pages carry a sourceOfTruth pointing outside the docs tree', async () => {
  const { pages } = await loadDocsManifest();
  for (const page of pages.filter((entry) => entry.slug.startsWith('concepts/'))) {
    assert.ok(page.sourceOfTruth, `${page.slug} must declare a source of truth`);
    assert.doesNotMatch(page.sourceOfTruth, /^docs\/product\//, 'source of truth cannot be another docs page');
  }
});
