import assert from 'node:assert/strict';
import test from 'node:test';
import { connectedIdentities, editableProfile, orcidLinkError, requestOwnProfile } from '../lib/account-settings.mjs';

test('profile form strips server fields and initializes nullable editable fields', () => {
  assert.deepEqual(editableProfile({ actorId: 'actor-a', displayName: 'Ada', bio: null, createdAt: 'now', deletedAt: null }), { displayName: 'Ada', bio: '', avatarUrl: '' });
});

test('all linked identities come from Auth and ignore manually entered ORCID metadata', () => {
  const user = { email: 'researcher@example.test', email_confirmed_at: 'now', app_metadata: { provider: 'email' }, user_metadata: { provider: 'orcid', orcid: 'unverified' } };
  assert.deepEqual(connectedIdentities(user).map((entry) => entry.kind), ['email']);
  user.identities = [{ id: 'github-id', provider: 'github', identity_data: { user_name: 'ada' } }, { id: 'orcid-id', provider: 'custom:orcid', identity_data: { sub: '0000-0002-1825-0097' } }];
  assert.deepEqual(connectedIdentities(user).map((entry) => entry.kind), ['email', 'github', 'custom:orcid']);
  assert.equal(connectedIdentities(user)[2].label, '0000-0002-1825-0097');
  assert.equal(connectedIdentities(user)[2].verified, true);
  assert.deepEqual(connectedIdentities(null), []);
});

test('ORCID linking-disabled error explains the required administrator action', () => {
  assert.match(orcidLinkError({ code: 'manual_linking_disabled', message: 'unexpected wording' }), /account linking is disabled/);
  assert.match(orcidLinkError(new Error('Manual linking is disabled')), /site administrator/);
  assert.equal(orcidLinkError(new Error('Identity already linked')), 'ORCID connect failed: Identity already linked');
});

test('profile requests do not fetch without a session', async () => {
  await assert.rejects(requestOwnProfile({ auth: { getSession: async () => ({ data: { session: null } }) }, apiUrl: 'https://api.evimesh.test', fetchImpl: () => assert.fail('must not fetch') }), /Please sign in/);
});

test('Actor provisioning retries once and preserves real errors', async () => {
  for (const failure of [{ status: 403, code: 'ACTOR_IDENTITY_NOT_FOUND', expected: 3 }, { status: 403, code: 'forbidden', expected: 1 }, { status: 500, code: 'unavailable', expected: 1 }]) {
    const paths = [];
    await assert.rejects(requestOwnProfile({
      auth: { getSession: async () => ({ data: { session: { access_token: 'user-token' } } }) }, apiUrl: 'https://api.evimesh.test',
      fetchImpl: async (url) => {
        paths.push(new URL(url).pathname);
        return url.endsWith('/actors/self') ? Response.json({ created: true }) : Response.json({ code: failure.code, message: 'original failure' }, { status: failure.status });
      },
    }), /original failure/);
    assert.equal(paths.length, failure.expected);
  }
});
