import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createWorker } from '../src/index.mjs';
import { createSupabaseReadRepository } from '../src/supabase-read-repository.mjs';
import { requestOwnProfile } from '../../web/lib/account-settings.mjs';

function setup({ provisioned = true, failWrite = false, emptyWrite = false } = {}) {
  const supabaseUrl = 'https://profile.supabase.co';
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const env = {
    SUPABASE_URL: supabaseUrl, SUPABASE_PUBLISHABLE_KEY: 'public-key',
    SUPABASE_JWKS: JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'profile-test', alg: 'ES256' }] }),
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'ES256', kid: 'profile-test', typ: 'JWT' });
  const payload = encode({ sub: 'user-a', aud: 'authenticated', iss: `${supabaseUrl}/auth/v1`, exp: Math.floor(Date.now() / 1000) + 3600 });
  const signature = sign('SHA256', Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  const token = `${header}.${payload}.${signature}`;
  let actorId = provisioned ? 'actor-a' : null;
  const profiles = new Map([['actor-other', { actor_id: 'actor-other', bio: 'Private other profile' }]]);
  const calls = [];
  const worker = createWorker({ fetchImpl: async (endpoint, options) => {
    const url = new URL(endpoint);
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, options, method, body });
    assert.equal(options.headers.apikey, 'public-key');
    if (url.pathname !== '/rest/v1/actor_directory') assert.equal(options.headers.authorization, `Bearer ${token}`, 'owner reads and writes must carry the caller JWT');
    if (url.pathname === '/rest/v1/identities') {
      if (method === 'POST') { actorId = body[0].actor_id; return Response.json(body, { status: 201 }); }
      assert.equal(url.searchParams.get('subject'), 'eq.user-a');
      return Response.json(actorId ? [{ actor_id: actorId, subject: 'user-a', provider: 'supabase' }] : []);
    }
    if (url.pathname === '/rest/v1/actors') {
      assert.equal(body[0].auth_subject, 'user-a');
      assert.equal(body[0].actor_type, 'human');
      assert.equal(body[0].identity_strength, 'self_declared');
      assert.match(body[0].actor_id, /^actor_/);
      return new Response(null, { status: 201 });
    }
    if (url.pathname === '/rest/v1/actor_directory') return Response.json([{ actor_id: actorId, actor_type: 'human' }]);
    assert.equal(url.pathname, '/rest/v1/actor_profiles');
    if (method === 'GET') {
      assert.equal(url.searchParams.get('actor_id'), `eq.${actorId}`);
      assert.equal(url.searchParams.get('deleted_at'), 'is.null');
      return Response.json(profiles.has(actorId) ? [profiles.get(actorId)] : []);
    }
    assert.equal(method, 'POST');
    assert.equal(body.actor_id, actorId, 'writes must never target a caller-supplied Actor');
    assert.equal(url.searchParams.get('on_conflict'), 'actor_id');
    assert.equal(options.headers.prefer, 'resolution=merge-duplicates,return=representation');
    assert.equal(Object.hasOwn(body, 'created_at'), false);
    assert.equal(Object.hasOwn(body, 'deleted_at'), false);
    if (failWrite) return Response.json({ message: 'row ownership rejected' }, { status: 403 });
    if (emptyWrite) return Response.json([]);
    const row = { display_name: null, bio: null, avatar_url: null, created_at: '2026-09-01T00:00:00Z', ...profiles.get(actorId), ...body };
    profiles.set(actorId, row);
    return Response.json([row], { status: 201 });
  } });
  const request = (path, options = {}) => worker.fetch(new Request(`https://api.evimesh.test${path}`, {
    ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...options.headers },
  }), env);
  const client = (options = {}) => requestOwnProfile({
    auth: { getSession: async () => ({ data: { session: { access_token: token } } }) },
    apiUrl: 'https://api.evimesh.test', fetchImpl: (url, init) => request(new URL(url).pathname, init), ...options,
  });
  return { request, client, profiles, calls };
}

test('hosted profile: first save, readback and partial update use an atomic owner upsert', async () => {
  const { request, profiles, calls } = setup();
  assert.equal((await request('/profile')).status, 404);
  const first = await request('/profile', { method: 'PATCH', body: JSON.stringify({ displayName: 'Ada', bio: 'Researcher' }) });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).displayName, 'Ada');
  const read = await request('/profile');
  assert.equal((await read.json()).bio, 'Researcher');
  const update = await request('/profile', { method: 'PATCH', body: JSON.stringify({ bio: null }) });
  const updated = await update.json();
  assert.equal(updated.displayName, 'Ada');
  assert.equal(updated.bio, null);
  assert.equal(updated.createdAt, '2026-09-01T00:00:00Z');
  assert.equal(profiles.get('actor-other').bio, 'Private other profile');
  assert.equal(calls.filter((call) => call.method === 'POST').length, 2);
});

test('Settings request provisions a new Actor once and creates its first profile', async () => {
  const { client, calls } = setup({ provisioned: false });
  const saved = await client({ method: 'PATCH', profile: { displayName: 'New researcher', actorId: 'actor-other', createdAt: 'ignored' } });
  assert.equal(saved.displayName, 'New researcher');
  assert.notEqual(saved.actorId, 'actor-other');
  const reloaded = await client();
  assert.equal(reloaded.actorId, saved.actorId);
  await client({ method: 'PATCH', profile: { ...reloaded, bio: 'Second save' } });
  assert.equal((await client()).bio, 'Second save');
  assert.equal(calls.filter((call) => call.url.pathname === '/rest/v1/actors').length, 1);
});

test('profile rejects ownership, verification and lifecycle fields before writing', async () => {
  const { request, calls } = setup();
  for (const patch of [{ actorId: 'actor-other' }, { identityStrength: 'verified' }, { createdAt: 'now' }, { displayName: 42 }, {}, []]) {
    const response = await request('/profile', { method: 'PATCH', body: JSON.stringify(patch) });
    assert.equal(response.status, 400);
  }
  assert.equal(calls.filter((call) => call.method !== 'GET').length, 0);
});

test('profile rejects missing and invalid JWTs before accessing PostgREST', async () => {
  const { request, calls } = setup();
  for (const authorization of ['', 'Bearer invalid']) {
    const response = await request('/profile', { method: 'PATCH', headers: { authorization }, body: '{"bio":"test"}' });
    assert.equal(response.status, 401);
  }
  assert.equal(calls.length, 0);
});

test('profile does not report success when PostgREST rejects or returns no row', async () => {
  for (const options of [{ failWrite: true }, { emptyWrite: true }]) {
    const { request } = setup(options);
    const response = await request('/profile', { method: 'PATCH', body: '{"bio":"test"}' });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).code, 'ACTOR_PROFILE_WRITE_FAILED');
  }
});

test('anonymous profile lookup never uses the optional service credential', async () => {
  const repository = createSupabaseReadRepository({
    url: 'https://profile.supabase.co', publishableKey: 'public-key', serviceRoleKey: 'private-service-key',
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.apikey, 'public-key');
      assert.notEqual(options.headers.authorization, 'Bearer private-service-key');
      return Response.json([]);
    },
  });
  assert.equal(await repository.getActorProfile('actor-other'), null);
});
