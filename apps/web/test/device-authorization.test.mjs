import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  approveDeviceGrant,
  denyDeviceGrant,
  deviceGrantOutcome,
  fetchDeviceGrant,
  fetchManagedAgentActors,
  formatUserCode,
  isCompleteUserCode,
} from '../lib/device-authorization.mjs';

const API = 'https://api.evimesh.test';
const TOKEN = 'human-session-token';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('device user codes are paste-friendly but reject ambiguous characters', () => {
  assert.equal(formatUserCode('abcd efgh'), 'ABCD-EFGH');
  assert.equal(formatUserCode('abcd-efgh-extra'), 'ABCD-EFGH');
  assert.equal(formatUserCode('ab01-cd23'), 'ABCD-23');
  assert.equal(isCompleteUserCode('ABCD-EFGH'), true);
  assert.equal(isCompleteUserCode('ABCD-23'), false);
});

test('connection preview uses the authenticated human session and exposes no device secret', async () => {
  const calls = [];
  const grant = await fetchDeviceGrant('abcd-efgh', {
    accessToken: TOKEN,
    apiUrl: `${API}/`,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        status: 'pending',
        client_id: 'evimesh-cli',
        requested_scopes: ['profile:read', 'research:prepare'],
        expires_at: '2026-08-31T12:00:00.000Z',
      });
    },
  });

  assert.deepEqual(grant, {
    status: 'pending',
    clientId: 'evimesh-cli',
    requestedScopes: ['profile:read', 'research:prepare'],
    expiresAt: '2026-08-31T12:00:00.000Z',
  });
  assert.deepEqual(calls, [{
    url: `${API}/auth/device/grants/ABCD-EFGH`,
    options: {
      method: 'GET',
      headers: { accept: 'application/json', authorization: `Bearer ${TOKEN}` },
      body: undefined,
    },
  }]);
  assert.equal(JSON.stringify(grant).includes('device_code'), false);
});

test('managed Agent lookup is owner-scoped and fails closed on non-Agent rows', async () => {
  const calls = [];
  const agents = await fetchManagedAgentActors({
    accessToken: TOKEN,
    apiUrl: API,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        items: [
          { actorId: 'agent-1', actorType: 'agent', modelName: 'Research Agent', runtime: 'local' },
          { actorId: 'human-1', actorType: 'human' },
        ],
      });
    },
  });

  assert.deepEqual(agents, [{
    actorId: 'agent-1',
    actorType: 'agent',
    modelName: 'Research Agent',
    runtime: 'local',
    scope: null,
    publicKeyFingerprint: null,
  }]);
  assert.equal(calls[0].url, `${API}/actors/managed?actor_type=agent`);
  assert.equal(calls[0].options.headers.authorization, `Bearer ${TOKEN}`);
});

test('approval binds the selected Agent while denial carries only the user code', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('/approve')
      ? jsonResponse({ status: 'approved', agent_actor_id: 'agent-1', expires_at: '2026-08-31T12:00:00.000Z' })
      : jsonResponse({ status: 'denied' });
  };

  await approveDeviceGrant({ userCode: 'ABCD-EFGH', agentActorId: 'agent-1' }, { accessToken: TOKEN, apiUrl: API, fetchImpl });
  await denyDeviceGrant('ABCD-EFGH', { accessToken: TOKEN, apiUrl: API, fetchImpl });

  assert.deepEqual(JSON.parse(calls[0].options.body), { user_code: 'ABCD-EFGH', agent_actor_id: 'agent-1' });
  assert.deepEqual(JSON.parse(calls[1].options.body), { user_code: 'ABCD-EFGH' });
  assert.equal(calls[0].options.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[1].options.headers.authorization, `Bearer ${TOKEN}`);
});

test('protocol errors map to distinct terminal, permission and session states', async () => {
  assert.equal(deviceGrantOutcome({ code: 'expired_token', status: 404 }), 'expired');
  assert.equal(deviceGrantOutcome({ code: 'device_grant_used', status: 409 }), 'used');
  assert.equal(deviceGrantOutcome({ code: 'access_denied', status: 409 }), 'denied');
  assert.equal(deviceGrantOutcome({ status: 401 }), 'session');
  assert.equal(deviceGrantOutcome({ status: 403 }), 'permission');
  assert.equal(deviceGrantOutcome({ code: 'service_unavailable', status: 503 }), 'error');
});

test('/device gates authorization on live capabilities and implements the full human decision surface', async () => {
  const page = await readFile(new URL('../app/device/page.js', import.meta.url), 'utf8');

  assert.match(page, /fetchPublicCapabilities\(\)/);
  assert.match(page, /deviceAuthorization\.enabled === true/);
  assert.match(page, /useBrowserSession\(\)/);
  assert.match(page, /fetchDeviceGrant/);
  assert.match(page, /fetchManagedAgentActors/);
  assert.match(page, /agent_actor_id/);
  assert.match(page, /Deny request/);
  assert.match(page, /Approve Agent/);
  assert.match(page, /Human signing keys stay on the local device\./);
  assert.match(page, /view === 'permission'/);
  for (const state of ['approved', 'denied', 'expired', 'used', 'no-agents', 'error']) {
    assert.match(page, new RegExp(`'${state}'`));
  }
  assert.doesNotMatch(page, /research:sign|private[_ -]?key/i);
  assert.doesNotMatch(page, /[—–]/);
});
