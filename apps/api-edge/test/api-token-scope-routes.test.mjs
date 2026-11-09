import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/index.mjs';
import { createActorApiToken } from '../../../packages/domain/src/api-token.mjs';
import { canonicalJson, rawHash } from '../../../packages/protocol/src/hash.mjs';
import { generateEd25519KeyPair } from '../../../packages/signatures/src/ed25519.mjs';
import { signEd25519Payload } from '../../../packages/signatures/src/client-signature.mjs';

const PRODUCT_ENV = {
  EVIMESH_RESEARCH_PREPARE_ENABLED: 'true',
  EVIMESH_RESEARCH_SUBMIT_ENABLED: 'true',
};
const PRODUCT_READY = {
  deviceAuthorization: false,
  researchPrepare: true,
  researchSubmit: true,
};
const KERNEL_CUTOVER = { researchGraphRollout: { writeMode: 'kernel', cutoverReady: true } };

async function issueToken({ scopes, actorId = 'agent-1' }) {
  const records = new Map();
  const insertApiToken = async (record) => {
    const persisted = { ...record, tokenId: `token-${records.size + 1}`, actorId };
    records.set(record.tokenHash, persisted);
    return persisted;
  };
  const { token } = await createActorApiToken({
    repository: { insertApiToken, withTransaction: async (callback) => callback({ insertApiToken }) },
    actorId,
    scopes,
    issuanceContext: 'device_authorization',
  });
  return { token, records };
}

function repositoryOver(records, { actorType = 'agent', calls = {} } = {}) {
  return {
    findApiTokenByHash: async (hash) => { calls.findToken = (calls.findToken ?? 0) + 1; return records.get(hash) ?? null; },
    updateApiTokenLastUsedAt: async () => true,
    getActor: async (actorId) => { calls.getActor = (calls.getActor ?? 0) + 1; return { actorId, actorType }; },
    findActiveSigningKey: async () => null,
  };
}

function bearer(token) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function signatureEnvelope({ payload, nonce, keyId, privateKey }) {
  const eventType = 'answer.created';
  const signingBytes = canonicalJson({ event_type: eventType, payload, nonce });
  return {
    schema: 'srp.client-signature-envelope.v1',
    event_type: eventType,
    payload,
    nonce,
    signing_bytes_hash: `sha256:${rawHash(signingBytes)}`,
    signature: {
      algorithm: 'Ed25519',
      key_id: keyId,
      value: await signEd25519Payload({ signingBytes: new TextEncoder().encode(signingBytes), privateKey }),
    },
  };
}

test('auth/me and research reads enforce their registered scopes', async () => {
  const profileOnly = await issueToken({ scopes: ['profile:read'] });
  const app = createApp({ repository: repositoryOver(profileOnly.records) });

  const me = await app.fetch(new Request('https://api.example.test/auth/me', { headers: bearer(profileOnly.token) }), {});
  assert.equal(me.status, 200, await me.clone().text());

  const research = await app.fetch(new Request('https://api.example.test/questions', { headers: bearer(profileOnly.token) }), {});
  assert.equal(research.status, 403);
  assert.equal((await research.json()).code, 'API_TOKEN_SCOPE_FORBIDDEN');

  const projectOnly = await issueToken({ scopes: ['project:read'] });
  const noProfile = createApp({ repository: repositoryOver(projectOnly.records) });
  const deniedMe = await noProfile.fetch(new Request('https://api.example.test/auth/me', { headers: bearer(projectOnly.token) }), {});
  assert.equal(deniedMe.status, 403);
  assert.equal((await deniedMe.json()).code, 'API_TOKEN_SCOPE_FORBIDDEN');
});

test('tokens carrying unknown scopes or research:sign are rejected as invalid credentials', async () => {
  for (const scope of ['claim:read', 'research:sign']) {
    const fixture = await issueToken({ scopes: ['profile:read'] });
    for (const record of fixture.records.values()) record.scopes = [scope];
    const app = createApp({ repository: repositoryOver(fixture.records) });
    const response = await app.fetch(new Request('https://api.example.test/auth/me', { headers: bearer(fixture.token) }), {});
    assert.equal(response.status, 401, scope);
    assert.equal((await response.json()).code, 'unauthorized');
  }
});

test('artifact upload planning requires artifact:upload before the signer runs', async () => {
  const missing = await issueToken({ scopes: ['project:read'] });
  let signerCalls = 0;
  const input = {
    artifactId: 'artifact-1',
    revision: 1,
    rawHash: `sha256:${'a'.repeat(64)}`,
    sizeBytes: 4,
    mediaType: 'text/plain',
    fileName: 'evidence.txt',
  };
  const denied = createApp({
    repository: repositoryOver(missing.records),
    uploadSigner: async () => { signerCalls += 1; return { url: 'https://r2.example.test/upload' }; },
  });
  const response = await denied.fetch(new Request('https://api.example.test/artifacts/upload-plan', {
    method: 'POST', headers: bearer(missing.token), body: JSON.stringify(input),
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'API_TOKEN_SCOPE_FORBIDDEN');
  assert.equal(signerCalls, 0);

  const jwtApp = createApp({
    repository: { findIdentity: async () => ({ actorId: 'human-1' }) },
    capabilityReadiness: PRODUCT_READY,
    authenticate: async () => ({ sub: 'human-subject' }),
    uploadSigner: async () => { signerCalls += 1; return { url: 'https://r2.example.test/upload' }; },
  });
  const jwtResponse = await jwtApp.fetch(new Request('https://api.example.test/artifacts/upload-plan', {
    method: 'POST', headers: bearer('supabase-jwt'), body: JSON.stringify(input),
  }), PRODUCT_ENV);
  assert.equal(jwtResponse.status, 403);
  assert.equal((await jwtResponse.json()).code, 'ARTIFACT_AGENT_TOKEN_REQUIRED');
  assert.equal(signerCalls, 0);

  const allowedFixture = await issueToken({ scopes: ['artifact:upload'] });
  const allowed = createApp({
    repository: repositoryOver(allowedFixture.records),
    capabilityReadiness: PRODUCT_READY,
    uploadSigner: async () => { signerCalls += 1; return { url: 'https://r2.example.test/upload' }; },
  });
  const planned = await allowed.fetch(new Request('https://api.example.test/artifacts/upload-plan', {
    method: 'POST', headers: bearer(allowedFixture.token), body: JSON.stringify(input),
  }), {});
  assert.equal(planned.status, 201, await planned.clone().text());
  assert.equal(signerCalls, 1);
});

test('disabled capabilities return 503 before auth, repository, nonce, signature, or event work', async () => {
  const calls = { authenticate: 0, getActor: 0, nonce: 0, event: 0, role: 0 };
  const repository = {
    getActor: async () => { calls.getActor += 1; return { actorId: 'agent-1', actorType: 'agent' }; },
  };
  const app = createApp({
    ...KERNEL_CUTOVER,
    repository,
    capabilityReadiness: { deviceAuthorization: false, researchPrepare: false, researchSubmit: false },
    authenticate: async () => { calls.authenticate += 1; return { sub: 'human-subject' }; },
    signatureNonceStore: { claimSignatureNonce: async () => { calls.nonce += 1; return true; } },
    typedResearchRoleResolver: async () => { calls.role += 1; return 'contributor'; },
    typedResearchEventFactory: async () => { calls.event += 1; return {}; },
  });
  for (const path of ['/answers/prepare', '/answers']) {
    const response = await app.fetch(new Request(`https://api.example.test${path}`, {
      method: 'POST',
      headers: { authorization: 'Bearer supabase-jwt', 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    }), PRODUCT_ENV);
    assert.equal(response.status, 503, path);
  }
  assert.deepEqual(calls, { authenticate: 0, getActor: 0, nonce: 0, event: 0, role: 0 });
});

test('public product mode closes legacy direct research mutations before authentication', async () => {
  let authenticationCalls = 0;
  let eventCalls = 0;
  const app = createApp({
    repository: {},
    capabilityReadiness: PRODUCT_READY,
    authenticate: async () => { authenticationCalls += 1; return { sub: 'human-subject' }; },
    claimEventFactory: async () => { eventCalls += 1; return {}; },
    claimRoleResolver: async () => 'contributor',
  });
  const response = await app.fetch(new Request('https://api.example.test/claims', {
    method: 'POST',
    headers: { authorization: 'Bearer supabase-jwt', 'content-type': 'application/json' },
    body: JSON.stringify({ claimId: 'claim-1' }),
  }), PRODUCT_ENV);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'LEGACY_RESEARCH_WRITE_UNAVAILABLE');
  assert.equal(authenticationCalls, 0);
  assert.equal(eventCalls, 0);
});

test('public typed writes reject human JWTs, missing scopes, and non-Agent token actors', async () => {
  const jwtApp = createApp({
    repository: { findIdentity: async () => ({ actorId: 'human-1' }) },
    capabilityReadiness: PRODUCT_READY,
    authenticate: async () => ({ sub: 'human-subject' }),
  });
  const jwtResponse = await jwtApp.fetch(new Request('https://api.example.test/answers/prepare', {
    method: 'POST', headers: bearer('supabase-jwt'), body: JSON.stringify({}),
  }), PRODUCT_ENV);
  assert.equal(jwtResponse.status, 403);
  assert.equal((await jwtResponse.json()).code, 'RESEARCH_AGENT_TOKEN_REQUIRED');

  const missingScope = await issueToken({ scopes: ['project:read'] });
  const missingScopeApp = createApp({ repository: repositoryOver(missingScope.records), capabilityReadiness: PRODUCT_READY });
  const scopeResponse = await missingScopeApp.fetch(new Request('https://api.example.test/answers/prepare', {
    method: 'POST', headers: bearer(missingScope.token), body: JSON.stringify({}),
  }), PRODUCT_ENV);
  assert.equal(scopeResponse.status, 403);
  assert.equal((await scopeResponse.json()).code, 'API_TOKEN_SCOPE_FORBIDDEN');

  const humanToken = await issueToken({ scopes: ['research:prepare'], actorId: 'human-1' });
  const humanTokenApp = createApp({
    repository: repositoryOver(humanToken.records, { actorType: 'human' }),
    capabilityReadiness: PRODUCT_READY,
  });
  const actorResponse = await humanTokenApp.fetch(new Request('https://api.example.test/answers/prepare', {
    method: 'POST', headers: bearer(humanToken.token), body: JSON.stringify({}),
  }), PRODUCT_ENV);
  assert.equal(actorResponse.status, 403);
  assert.equal((await actorResponse.json()).code, 'RESEARCH_AGENT_ACTOR_REQUIRED');
});

test('public typed writes derive the human signer from the Agent owner and authorize the Agent membership', async () => {
  const fixture = await issueToken({ scopes: ['research:prepare', 'research:submit'] });
  const humanKey = await generateEd25519KeyPair();
  const keyId = 'human-key';
  let submitInput = null;
  const repository = {
    ...repositoryOver(fixture.records),
    getActor: async (actorId) => actorId === 'agent-1'
      ? { actorId, actorType: 'agent', ownerActorId: 'human-1' }
      : actorId === 'human-1' || actorId === 'human-2'
        ? { actorId, actorType: 'human' }
        : null,
  };
  const app = createApp({
    ...KERNEL_CUTOVER,
    repository,
    capabilityReadiness: PRODUCT_READY,
    typedResearchSubmitter: {
      ready: true,
      submit: async (input) => {
        submitInput = input;
        const error = new Error('atomic submit reached');
        error.code = 'ATOMIC_SUBMIT_REACHED';
        error.status = 409;
        throw error;
      },
    },
    typedResearchRoleResolver: async () => {
      const error = new Error('legacy role resolver must not run');
      error.code = 'LEGACY_ROLE_RESOLVER_REACHED';
      error.status = 409;
      throw error;
    },
    typedResearchEventFactory: async () => { throw new Error('legacy event factory must not run'); },
  });
  const input = {
    answerId: 'answer-1', projectId: 'project-1', title: 'Agent synthesis',
    synthesis: 'Prepared by the managed Agent.', limitations: [],
    questionRef: { kind: 'question', id: 'question-1', revision: 1 }, additionalInputs: [],
    nonce: '0123456789abcdef',
  };

  const forged = await app.fetch(new Request('https://api.example.test/answers/prepare', {
    method: 'POST', headers: bearer(fixture.token), body: JSON.stringify({ ...input, publisherActorId: 'human-2' }),
  }), PRODUCT_ENV);
  assert.equal(forged.status, 403);
  assert.equal((await forged.json()).code, 'RESEARCH_PUBLISHER_OWNERSHIP_MISMATCH');

  const preparedResponse = await app.fetch(new Request('https://api.example.test/answers/prepare', {
    method: 'POST', headers: bearer(fixture.token), body: JSON.stringify(input),
  }), PRODUCT_ENV);
  assert.equal(preparedResponse.status, 200, await preparedResponse.clone().text());
  const prepared = await preparedResponse.json();
  assert.equal(prepared.payload.publisherActorId, 'human-1');
  assert.equal(prepared.payload.draftedByActorId, 'agent-1');

  const signed = await signatureEnvelope({
    payload: prepared.payload,
    nonce: prepared.nonce,
    keyId,
    privateKey: humanKey.private_key,
  });
  const submitted = await app.fetch(new Request('https://api.example.test/answers', {
    method: 'POST',
    headers: bearer(fixture.token),
    body: JSON.stringify({ ...input, nonce: undefined, signatureEnvelope: signed }),
  }), PRODUCT_ENV);
  assert.equal(submitted.status, 409);
  assert.equal((await submitted.json()).code, 'ATOMIC_SUBMIT_REACHED');
  assert.equal(submitInput.agentActorId, 'agent-1');
  assert.equal(submitInput.publisherActorId, 'human-1');
  assert.equal(submitInput.signatureEnvelope.signature.key_id, keyId);
});

test('an Agent submit token has no signing capability and confirm true is inert', async () => {
  const fixture = await issueToken({ scopes: ['research:submit'] });
  let submitCalls = 0;
  const app = createApp({
    ...KERNEL_CUTOVER,
    repository: repositoryOver(fixture.records),
    capabilityReadiness: PRODUCT_READY,
    typedResearchSubmitter: {
      ready: true,
      submit: async () => { submitCalls += 1; return {}; },
    },
  });
  const response = await app.fetch(new Request('https://api.example.test/answers', {
    method: 'POST',
    headers: bearer(fixture.token),
    body: JSON.stringify({ confirm: true }),
  }), PRODUCT_ENV);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'RESEARCH_PUBLISHER_SIGNATURE_REQUIRED');
  assert.equal(submitCalls, 0);
});

test('API tokens cannot manage tokens and manual issuance is unavailable', async () => {
  const fixture = await issueToken({ scopes: ['profile:read', 'project:read'] });
  const calls = { list: 0, insert: 0, revoke: 0 };
  const repository = {
    ...repositoryOver(fixture.records),
    listApiTokensByActor: async () => { calls.list += 1; return []; },
    insertApiToken: async () => { calls.insert += 1; return {}; },
    revokeApiToken: async () => { calls.revoke += 1; return {}; },
  };
  const app = createApp({ repository });
  const list = await app.fetch(new Request('https://api.example.test/api-tokens', { headers: bearer(fixture.token) }), {});
  assert.equal(list.status, 403);
  assert.equal((await list.json()).code, 'API_TOKEN_SESSION_REQUIRED');
  const revoke = await app.fetch(new Request('https://api.example.test/api-tokens/token-1', { method: 'DELETE', headers: bearer(fixture.token) }), {});
  assert.equal(revoke.status, 403);
  assert.equal((await revoke.json()).code, 'API_TOKEN_SESSION_REQUIRED');
  assert.equal(calls.list, 0);
  assert.equal(calls.revoke, 0);

  const manual = createApp({
    repository: {
      findIdentity: async () => ({ actorId: 'human-1' }),
      getActor: async () => ({ actorId: 'human-1', actorType: 'human' }),
      insertApiToken: async () => { calls.insert += 1; return {}; },
    },
    authenticate: async () => ({ sub: 'human-subject' }),
  });
  const create = await manual.fetch(new Request('https://api.example.test/api-tokens', {
    method: 'POST', headers: bearer('supabase-jwt'), body: JSON.stringify({ scopes: ['profile:read'] }),
  }), {});
  assert.equal(create.status, 503);
  assert.equal((await create.json()).code, 'API_TOKEN_ISSUANCE_UNAVAILABLE');
  assert.equal(calls.insert, 0);
});
