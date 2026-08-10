import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** M13.7-A09: isolated six-path mature-product concept prototype. */
const source = await readFile(new URL('../app/prototypes/m13-7-a/page.js', import.meta.url), 'utf8');

test('prototype is client-side, illustrative, and exposes all six contract scenes', () => {
  assert.match(source, /'use client'/);
  assert.match(source, /Illustrative prototype · fixture copy only/);
  for (const scene of ['Landing', 'Sign in', 'Home', 'Research workspace', 'Account Settings', 'Agent Connect']) assert.match(source, new RegExp(`['"]${scene}['"]`));
  for (const path of ['/ (anonymous)', '/sign-in', '/ (signed in)', '/questions/Q-204', '/account/profile', '/agent']) assert.ok(source.includes(path), `missing ${path} path preview`);
});

test('prototype remains fixture-only and has no product integration identifiers', () => {
  assert.match(source, /const FIXTURE_PRODUCT/);
  assert.doesNotMatch(source, /\bfetch\s*\(|supabase|apiClient|analytics|localStorage|sessionStorage|navigator\.clipboard/i);
  assert.doesNotMatch(source, /<form|<a\s|next\/link/i);
});

test('scene controls have persistent ARIA tab panels and keyboard navigation', () => {
  for (const wording of ['role="tablist"', 'role="tab"', 'role="tabpanel"', 'aria-selected', 'aria-controls', 'onKeyDown', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'tabIndex']) assert.match(source, new RegExp(wording));
  assert.match(source, /hidden=\{hidden\}/);
  for (const component of ['LandingScene', 'SignInScene', 'HomeScene', 'ResearchWorkspaceScene', 'AccountScene', 'AgentScene']) assert.match(source, new RegExp(`<${component} hidden=\\{scene !==`));
});

test('research semantics preserve Argument, Evidence, Verification, and Frontier without a scalar score', () => {
  for (const wording of ['Argument', 'Evidence', 'Verification', 'Frontier', 'supports, refutes, qualifies, or reproduces', 'source-traceable', 'open challenge', 'does not determine research validity']) assert.match(source, new RegExp(wording));
  assert.doesNotMatch(source, /support score|truth score|quality score|confidence|percentage|progress bar/i);
});
