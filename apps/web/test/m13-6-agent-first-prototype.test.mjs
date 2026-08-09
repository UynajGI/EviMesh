import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** M13.6-A09: an isolated, keyboard-accessible research-record prototype. */
const source = await readFile(new URL('../app/prototypes/m13-6-a/page.js', import.meta.url), 'utf8');

test('prototype is a client-side illustrative route with four scenes', () => {
  assert.match(source, /'use client'/);
  assert.match(source, /Illustrative prototype/);
  for (const scene of ['Question', 'Claim', 'Change feed', 'Handoff']) {
    assert.match(source, new RegExp(`['\"]${scene}['\"]`), `missing ${scene} scene`);
  }
});

test('prototype relies on local fixtures and does not invoke product integrations', () => {
  assert.match(source, /const FIXTURE_RESEARCH/);
  assert.doesNotMatch(source, /\bfetch\s*\(|supabase|apiClient|analytics|navigator\.clipboard|localStorage|sessionStorage/i);
  assert.doesNotMatch(source, /<form|<a\s|next\/link/i);
});

test('claim view presents provenance and all four Evidence relation buckets instead of scalar judgment', () => {
  for (const wording of ['Immutable revision', 'Source references', 'Evidence relations', 'Supports the claim', 'Refutes the claim', 'Qualifies the claim', 'Reproduces the claim', 'Verification', 'Finding', 'Challenge', 'Latest event']) {
    assert.match(source, new RegExp(wording), `missing ${wording}`);
  }
  assert.doesNotMatch(source, /Challenges the claim/);
  assert.doesNotMatch(source, /support score|truth score|confidence|percentage|progress bar/i);
});

test('scene controls have tab semantics and keyboard navigation', () => {
  for (const wording of ['role="tablist"', 'role="tab"', 'role="tabpanel"', 'aria-selected', 'aria-controls', 'onKeyDown', 'ArrowRight', 'ArrowLeft', 'Home', 'End']) {
    assert.match(source, new RegExp(wording), `missing accessible control ${wording}`);
  }
});

test('every tab control retains an in-DOM panel and only inactive scenes are hidden', () => {
  assert.match(source, /function Panel\(\{ scene, hidden, children \}\)/);
  assert.match(source, /hidden=\{hidden\}/);
  for (const [scene, component] of Object.entries({ Question: 'QuestionScene', Claim: 'ClaimScene', 'Change feed': 'ChangeFeedScene', Handoff: 'HandoffScene' })) {
    assert.match(source, new RegExp(`<${component} hidden=\\{scene !== '${scene}'\\} />`), `missing persistent ${scene} panel`);
  }
  assert.doesNotMatch(source, /scene === 'Question' \? <QuestionScene|scene === 'Claim' \? <ClaimScene|scene === 'Change feed' \? <ChangeFeedScene|scene === 'Handoff' \? <HandoffScene/);
});

test('change attention is provenance-based and handoff remains explanatory', () => {
  for (const wording of ['Attention priority', 'event provenance', 'Provenance:', 'Agent context', 'CLI context', 'MCP context', 'Copyable preview', 'Explanatory preview only', 'No integration runs from this prototype']) {
    assert.match(source, new RegExp(wording), `missing ${wording}`);
  }
});
