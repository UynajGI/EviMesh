import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AUTH_SEEN_STORAGE_KEY,
  bootstrapActorForSession,
  callbackErrorMessage,
  clearAuthenticatedSessionMarker,
  markAuthenticatedSession,
  missingSessionStatus,
  safeCallbackPath,
} from '../lib/auth-session.mjs';

function storageFixture() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('session marker separates a fresh anonymous browser from an ended session', () => {
  const storage = storageFixture();
  assert.equal(missingSessionStatus(storage), 'anonymous');
  markAuthenticatedSession(storage);
  assert.equal(storage.values.get(AUTH_SEEN_STORAGE_KEY), '1');
  assert.equal(missingSessionStatus(storage), 'expired');
  clearAuthenticatedSessionMarker(storage);
  assert.equal(missingSessionStatus(storage), 'anonymous');
});

test('callback continuation accepts only local non-recursive paths', () => {
  assert.equal(safeCallbackPath('/settings?tab=keys'), '/settings?tab=keys');
  assert.equal(safeCallbackPath('https://attacker.example/path'), '/');
  assert.equal(safeCallbackPath('//attacker.example/path'), '/');
  assert.equal(safeCallbackPath('/\\attacker.example/path'), '/');
  assert.equal(safeCallbackPath('/auth/callback?next=/settings'), '/');
  assert.equal(callbackErrorMessage({ search: '?error_description=Access+denied', hash: '' }), 'Access denied');
});

test('authenticated callback bootstraps the Actor with the bearer session and accepts an existing binding', async () => {
  const requests = [];
  const result = await bootstrapActorForSession({ access_token: 'session-token' }, {
    apiUrl: 'https://api.evimesh.test/',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 201,
        json: async () => ({ actor: { actorId: 'actor-existing' }, created: false }),
      };
    },
  });

  assert.equal(result.created, false);
  assert.deepEqual(requests, [{
    url: 'https://api.evimesh.test/actors/self',
    options: { method: 'POST', headers: { authorization: 'Bearer session-token' } },
  }]);
});

test('Actor bootstrap preserves typed API failures and request ids', async () => {
  await assert.rejects(
    bootstrapActorForSession({ access_token: 'session-token' }, {
      apiUrl: 'https://api.evimesh.test',
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        json: async () => ({ code: 'ACTOR_IDENTITY_CONFLICT', message: 'Identity is already bound.', request_id: 'req-1' }),
      }),
    }),
    (error) => error.code === 'ACTOR_IDENTITY_CONFLICT' && error.status === 403 && error.requestId === 'req-1',
  );
});

test('login, callback, and shell share one explicit session lifecycle', async () => {
  const [login, callback, shell, controller, supabase] = await Promise.all([
    readFile(new URL('../app/login/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/auth/callback/page.js', import.meta.url), 'utf8'),
    readFile(new URL('../components/template-shell.js', import.meta.url), 'utf8'),
    readFile(new URL('../components/session-shell-control.js', import.meta.url), 'utf8'),
    readFile(new URL('../lib/supabase-browser.js', import.meta.url), 'utf8'),
  ]);

  assert.match(login, /authCallbackUrl\(\)/);
  assert.match(login, /window\.location\.assign\(authCallbackUrl\(\)\)/);
  assert.match(callback, /bootstrapActorForSession\(data\.session\)/);
  assert.match(callback, /Retry account setup/);
  assert.match(controller, /onAuthStateChange/);
  assert.match(controller, /client\.auth\.signOut\(\)/);
  assert.match(shell, /Session expired · Sign in again/);
  assert.match(shell, /Session unavailable · Sign in/);
  assert.match(shell, /Signed in/);
  assert.match(shell, /Sign out/);
  assert.match(supabase, /if \(browserClient\) return browserClient/);
  assert.match(supabase, /detectSessionInUrl:\s*true/);
  assert.match(supabase, /flowType:\s*'pkce'/);
});
