import assert from 'node:assert/strict';
import test from 'node:test';
import { authoritativeClaimsFromAuthUser, createSupabaseActorBootstrap } from '../src/actor-bootstrap.mjs';
import { createSupabaseApiTokenRepository } from '../src/supabase-api-token-repository.mjs';
import { revokeOwnToken, listOwnTokens } from '../src/api-token-api.mjs';

const SUBJECT = '6f1c3a2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b';

function authUser(overrides = {}) {
  return {
    id: SUBJECT,
    email: 'Lin@Example.TEST',
    email_confirmed_at: '2026-11-01T00:00:00Z',
    identities: [
      { provider: 'email', id: SUBJECT, created_at: '2026-11-01T00:00:00Z' },
      { provider: 'github', id: '1234567', identity_data: { email: 'lin@gh.test' }, created_at: '2026-11-02T00:00:00Z' },
      { provider: 'custom:orcid', id: 'x', identity_data: { sub: 'https://orcid.org/0000-0002-1825-0097' }, created_at: '2026-11-03T00:00:00Z' },
      { provider: 'github', id: '1234567', created_at: '2026-11-02T00:00:00Z' },
    ],
    ...overrides,
  };
}

test('authoritative claims come only from the Auth user record and match the 0089 RPC shape', () => {
  const claims = authoritativeClaimsFromAuthUser(authUser());
  assert.deepEqual(Object.keys(claims).sort(), ['authSubject', 'email', 'emailConfirmedAt', 'identities', 'schema', 'source']);
  assert.equal(claims.schema, 'evimesh.auth-bootstrap-claims.v1');
  assert.equal(claims.source, 'supabase_auth_admin');
  assert.equal(claims.email, 'lin@example.test');
  assert.deepEqual(claims.identities, [
    { provider: 'github', subject: '1234567', email: 'lin@gh.test', verifiedAt: '2026-11-02T00:00:00Z' },
    { provider: 'custom:orcid', subject: '0000-0002-1825-0097', verifiedAt: '2026-11-03T00:00:00Z' },
  ]);
  for (const identity of claims.identities) {
    assert.deepEqual(Object.keys(identity).filter((key) => !['provider', 'subject', 'email', 'verifiedAt'].includes(key)), []);
  }
});

test('unconfirmed email cannot bootstrap an Actor', () => {
  assert.throws(() => authoritativeClaimsFromAuthUser(authUser({ email_confirmed_at: null, confirmed_at: null })), (error) => error.code === 'ACTOR_BOOTSTRAP_EMAIL_NOT_VERIFIED' && error.status === 403);
});

test('bootstrap verifies the session with Auth, then calls the service-only RPC', async () => {
  const calls = [];
  const bootstrap = createSupabaseActorBootstrap({
    url: 'https://p.supabase.co',
    publishableKey: 'sb_publishable_x',
    serviceRoleKey: 'sb_secret_x',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/auth/v1/user')) return Response.json(authUser());
      return Response.json({ schema: 'evimesh.actor-bootstrap-result.v1', actorId: 'actor_1', actorType: 'human', identityStrength: 'verified', created: true });
    },
  });
  const result = await bootstrap.bootstrap({ accessToken: 'session-jwt', claims: { sub: SUBJECT } });
  assert.equal(result.actorId, 'actor_1');
  assert.equal(calls[0].options.headers.authorization, 'Bearer session-jwt');
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_x');
  assert.equal(calls[1].url, 'https://p.supabase.co/rest/v1/rpc/actor_self_bootstrap');
  assert.equal(calls[1].options.headers.apikey, 'sb_secret_x');
  assert.equal(calls[1].options.headers.authorization, undefined, 'opaque sb_secret keys are never sent as Bearer JWTs');
  assert.equal(JSON.parse(calls[1].options.body).p_authoritative_claims.authSubject, SUBJECT);
});

test('bootstrap rejects a JWT subject that disagrees with the Auth record and maps RPC guards', async () => {
  const mismatch = createSupabaseActorBootstrap({
    url: 'https://p.supabase.co', publishableKey: 'pk', serviceRoleKey: 'sk',
    fetchImpl: async () => Response.json(authUser()),
  });
  await assert.rejects(mismatch.bootstrap({ accessToken: 't', claims: { sub: 'someone-else' } }), (error) => error.status === 401);

  const conflict = createSupabaseActorBootstrap({
    url: 'https://p.supabase.co', publishableKey: 'pk', serviceRoleKey: 'sk',
    fetchImpl: async (url) => (String(url).endsWith('/auth/v1/user')
      ? Response.json(authUser())
      : Response.json({ message: '[ACTOR_BOOTSTRAP_IDENTITY_CONFLICT] concurrent identity ownership conflict' }, { status: 400 })),
  });
  await assert.rejects(conflict.bootstrap({ accessToken: 't' }), (error) => error.code === 'ACTOR_BOOTSTRAP_IDENTITY_CONFLICT' && error.status === 409);
  assert.equal(createSupabaseActorBootstrap({ url: 'https://p.supabase.co', publishableKey: 'pk' }), null);
});

test('API token adapter lists and revokes through the 0087 RPCs with a reason', async () => {
  const calls = [];
  const repository = createSupabaseApiTokenRepository({
    url: 'https://p.supabase.co',
    serviceRoleKey: 'sb_secret_x',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      if (String(url).endsWith('/api_token_list_owned_agent_tokens')) {
        return Response.json([{ tokenId: 't1', agentActorId: 'agent_1', tokenPrefix: 'evimesh_abcdefgh', label: 'cli', scopes: ['project:read'], createdAt: '2026-11-01', expiresAt: null, revokedAt: null, lastUsedAt: null }]);
      }
      if (String(url).endsWith('/api_token_revoke_owned_agent_token')) return Response.json({ tokenId: 't1', agentActorId: 'agent_1', revokedAt: '2026-11-09' });
      return Response.json({ message: '[API_TOKEN_NOT_FOUND] owned Agent token was not found' }, { status: 404 });
    },
  });
  const listed = await listOwnTokens({ repository, actorId: 'human_1' });
  assert.equal(listed[0].tokenPrefix, 'evimesh_abcdefgh');
  assert.equal(Object.hasOwn(listed[0], 'tokenHash'), false);
  assert.deepEqual(calls[0].body, { p_owner_actor_id: 'human_1' });

  const revoked = await revokeOwnToken({ repository, actorId: 'human_1', tokenId: 't1', reason: 'lost laptop' });
  assert.equal(revoked.revokedAt, '2026-11-09');
  assert.deepEqual(calls[1].body, { p_owner_actor_id: 'human_1', p_token_id: 't1', p_reason: 'lost laptop' });

  await assert.rejects(repository.updateApiTokenLastUsedAt('missing'), (error) => error.code === 'API_TOKEN_NOT_FOUND' && error.status === 404);
});
