import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceRelations } from '../lib/hydrate.mjs';

/** The relation column is relation_type in PostgREST (mapped to relationType);
 *  legacy payloads may still carry `relation`. Grouping must accept both. */
test('evidenceRelations reads the canonical relationType key', () => {
  assert.deepEqual(
    evidenceRelations({ claimLinks: [{ relationType: 'supports' }, { relationType: 'refutes' }] }),
    ['supports', 'refutes'],
  );
});

test('evidenceRelations falls back to the legacy relation key', () => {
  assert.deepEqual(evidenceRelations({ claimLinks: [{ relation: 'supports' }] }), ['supports']);
});

test('evidenceRelations mixes keys and drops unknown relations honestly', () => {
  assert.deepEqual(
    evidenceRelations({ claimLinks: [{ relation: 'supports' }, { relationType: 'qualifies' }, { actor: 'x' }] }),
    ['supports', 'qualifies'],
  );
});

test('evidenceRelations returns empty for missing links (ungrouped, never invented)', () => {
  assert.deepEqual(evidenceRelations({}), []);
  assert.deepEqual(evidenceRelations({ claimLinks: [] }), []);
  assert.deepEqual(evidenceRelations({ links: [{ relationType: 'supports' }] }), ['supports']);
});
