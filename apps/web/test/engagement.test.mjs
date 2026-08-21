import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');

/*
 * Engagement signal contracts (owner direction 2026-08-21). Freezes the
 * constitutional boundaries of the recommendation work: private signals with
 * no public counts, a separately labeled "For you" surface, and a
 * chronological feed that recommendations never reorder.
 */

test('engagement actions render private toggles, never counts', async () => {
  const src = await read('../components/engagement-actions.js');
  assert.match(src, /Heart/, 'useful mark renders the heart affordance');
  assert.match(src, /Bookmark/, 'save renders the bookmark affordance');
  assert.match(src, /aria-pressed/, 'toggles expose pressed state to assistive tech');
  assert.doesNotMatch(src, /\{[a-zA-Z.]*[Cc]ount[a-zA-Z.]*\}/, 'the action row must not render any count expression');
  assert.match(src, /never a public count/, 'the privacy boundary is stated in the component contract');
});

test('interaction client retries through self-provisioning on first authenticated use', async () => {
  const src = await read('../lib/interactions.mjs');
  assert.match(src, /ACTOR_IDENTITY_NOT_FOUND/, 'unprovisioned identities retry via /actors/self');
  assert.match(src, /\/actors\/self/, 'provisioning endpoint is wired');
  assert.match(src, /view-sent/, 'view signals are deduplicated per session');
  assert.doesNotMatch(src, /score/, 'no recommendation score may pass through the client');
});

test('home keeps the chronological feed and labels the personal rail', async () => {
  const src = await read('../app/home/page.js');
  assert.match(src, /For you/, 'the personal rail is labeled');
  assert.match(src, /navigation, not a rating/, 'the rail carries its protocol sentence');
  assert.match(src, /fetchRecommendations/, 'the rail reads the recommendation endpoint');
  assert.match(src, /EngagementActions/, 'feed cards expose useful/save toggles');
  assert.match(src, /Date\.parse\(right\.when \?\? 0\) - Date\.parse\(left\.when \?\? 0\)/, 'feed ordering stays strictly newest-first');
  assert.match(src, /href="\/saved"/, 'the saved list is reachable from home');
});

test('saved page lists only the viewer own saves with a signed-out scope state', async () => {
  const src = await read('../app/saved/page.js');
  assert.match(src, /kind=\['favorite'\]|kinds=\['favorite'\]|\['favorite'\]/, 'the page lists the favorite kind only');
  assert.match(src, /DeniedState/, 'signed-out viewers get the scope boundary state, not a fake list');
  assert.match(src, /never shown as public counts/i, 'privacy sentence present');
  assert.doesNotMatch(src, /score/, 'no scores in the saved list');
});

test('detail pages record one best-effort view signal per session', async () => {
  const question = await read('../app/questions/[questionId]/page.js');
  const claim = await read('../app/claims/[claimId]/page.js');
  assert.match(question, /recordView\('question', questionId\)/, 'question detail records a view');
  assert.match(claim, /recordView\('claim', claimId\)/, 'claim detail records a view');
});
