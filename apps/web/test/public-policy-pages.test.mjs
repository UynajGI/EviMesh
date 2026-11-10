import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { PUBLIC_POLICIES, POLICY_EFFECTIVE_DATE } from '../app/privacy/policy-content.js';

const ROUTES = [
  ['privacy', 'privacy'],
  ['terms', 'terms'],
  ['acceptable-use', 'acceptableUse'],
  ['research-content-policy', 'researchContent'],
  ['copyright', 'copyright'],
  ['support', 'support'],
  ['security', 'security'],
  ['governance', 'governance'],
];

test('all eight public policy routes exist and select their declared content', async () => {
  for (const [route, policyKey] of ROUTES) {
    const url = new URL(`../app/${route}/page.js`, import.meta.url);
    await access(url);
    const source = await readFile(url, 'utf8');
    assert.match(source, /export const metadata =/);
    assert.ok(source.includes(`<PolicyPage policyKey="${policyKey}" />`), `${route} must render ${policyKey}`);
  }
});

test('policy publication metadata is explicit and never claims Beta or GA readiness', () => {
  assert.equal(POLICY_EFFECTIVE_DATE, '2026-08-31');
  assert.deepEqual(Object.keys(PUBLIC_POLICIES).sort(), ROUTES.map(([, key]) => key).sort());
  for (const [key, policy] of Object.entries(PUBLIC_POLICIES)) {
    assert.ok(policy.review.includes('required before Public Beta'), `${key} needs a human review gate`);
    assert.ok(policy.sections.length >= 5, `${key} needs substantive policy sections`);
    assert.ok(policy.related.length >= 3, `${key} needs related public routes`);
  }
});

test('public policy copy preserves protocol, identity, and governance boundaries', () => {
  const source = JSON.stringify(PUBLIC_POLICIES);
  for (const phrase of [
    'draft, prepare, human local signature, and submit',
    'No research:sign scope exists',
    'A typed identifier is never treated as verified',
    'tombstone',
    'does not publish competitive scores or rankings',
    'does not claim that a three-person steward group',
  ]) assert.ok(source.includes(phrase), `policy set is missing boundary: ${phrase}`);
  assert.doesNotMatch(source, /\u2014/, 'policy pages use the project punctuation system without em dashes');
  assert.doesNotMatch(source, /99\.9%|24\/7|round-the-clock support|three named stewards are active/i, 'preview copy must not claim unproven operations');
});

test('shared policy layout is semantic, responsive, token-only, and keyboard reachable', async () => {
  const source = await readFile(new URL('../app/privacy/policy-page.js', import.meta.url), 'utf8');
  assert.match(source, /<PageContainer wide>/);
  assert.match(source, /<PageHeader title=\{policy\.title\} \/>/);
  assert.match(source, /<article className=/);
  assert.match(source, /<nav aria-label="Related policies"/);
  assert.match(source, /<time dateTime=\{POLICY_EFFECTIVE_DATE\}>/);
  assert.match(source, /min-h-11/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /grid-cols-12/);
  assert.match(source, /md:sticky md:top-24/);
  assert.doesNotMatch(source, /(?:bg|text|border)-\[\s*#/i, 'layout must not introduce raw colors');
  assert.doesNotMatch(source, /(?:from|via|to)-[a-z]/i, 'layout must not introduce gradients');
  assert.doesNotMatch(source, /<form|method:\s*['"]POST|onSubmit/, 'policy pages are read-only');
});

test('the production sitemap includes every public policy route', async () => {
  const source = await readFile(new URL('../app/sitemap.js', import.meta.url), 'utf8');
  for (const [route] of ROUTES) assert.ok(source.includes(`'/${route}'`), `sitemap is missing /${route}`);
});
