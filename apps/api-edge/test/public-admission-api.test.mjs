import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
  createSupabasePublicAdmissionRepository,
  PublicAdmissionApiError,
  registerPublicAdmissionApi,
} from '../src/public-admission-api.mjs';
import { createApp } from '../src/index.mjs';

const PUBLIC_KEY = Buffer.concat([
  Buffer.from('302a300506032b6570032100', 'hex'),
  Buffer.alloc(32, 9),
]).toString('base64url');
const NOW = new Date('2026-08-31T03:00:00.000Z');

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function admissionRepository(overrides = {}) {
  const calls = [];
  const repository = {
    calls,
    projectApprovalGraphWriteReady: false,
    getAuthenticatedUser: async () => ({ id: 'auth-subject-1', email_confirmed_at: '2026-08-30T00:00:00Z' }),
    getProjectRole: async ({ projectId, actorId }) => {
      calls.push({ method: 'getProjectRole', projectId, actorId });
      return 'owner';
    },
    completeOnboarding: async (input) => (calls.push({ method: 'completeOnboarding', input }), input),
    listSigningKeys: async (actorId) => {
      calls.push({ method: 'listSigningKeys', actorId });
      return [];
    },
    registerSigningKey: async (input) => (calls.push({ method: 'registerSigningKey', input }), input),
    revokeSigningKey: async (input) => (calls.push({ method: 'revokeSigningKey', input }), { ...input, revokedAt: NOW.toISOString() }),
    submitProjectApplication: async (input) => (calls.push({ method: 'submitProjectApplication', input }), input),
    withdrawProjectApplication: async (input) => (calls.push({ method: 'withdrawProjectApplication', input }), input),
    decideProjectApplication: async (input) => (calls.push({ method: 'decideProjectApplication', input }), input),
    createProjectInvitation: async (input) => (calls.push({ method: 'createProjectInvitation', input }), input),
    respondToProjectInvitation: async (input) => (calls.push({ method: 'respondToProjectInvitation', input }), input),
    revokeProjectInvitation: async (input) => (calls.push({ method: 'revokeProjectInvitation', input }), input),
    changeProjectMembershipRole: async (input) => (calls.push({ method: 'changeProjectMembershipRole', input }), input),
    removeProjectMembership: async (input) => (calls.push({ method: 'removeProjectMembership', input }), input),
    ...overrides,
  };
  return repository;
}

function api(repository, authentication = {}) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('requestId', 'request-test');
    return next();
  });
  registerPublicAdmissionApi(app, {
    admissionRepository: repository,
    authenticateHuman: async () => ({
      actorId: 'actor-authenticated',
      actor: { actorId: 'actor-authenticated', actorType: 'human' },
      claims: { sub: 'auth-subject-1' },
      accessToken: 'verified-user-jwt',
      ...authentication,
    }),
    now: () => NOW,
  });
  return app;
}

async function jsonRequest(app, path, { method = 'POST', body = {} } = {}) {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('hosted adapter invokes only fixed RPCs with service-role credentials', async () => {
  const calls = [];
  const repository = createSupabasePublicAdmissionRepository({
    url: 'https://project.supabase.co/',
    publishableKey: 'sb_publishable_public',
    serviceRoleKey: 'sb_secret_server',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, { applicationId: 'application-1' });
    },
  });
  const result = await repository.submitProjectApplication({
    applicantActorId: 'actor-1',
    proposedProjectId: 'project-1',
    name: 'Open methods',
    summary: 'A public project.',
    license: 'CC-BY-4.0',
    submittedAt: NOW.toISOString(),
  });
  assert.deepEqual(result, { applicationId: 'application-1' });
  assert.equal(calls[0].url, 'https://project.supabase.co/rest/v1/rpc/project_application_submit');
  assert.equal(calls[0].options.headers.apikey, 'sb_secret_server');
  assert.equal(calls[0].options.headers.authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    p_applicant_actor_id: 'actor-1',
    p_proposed_project_id: 'project-1',
    p_name: 'Open methods',
    p_summary: 'A public project.',
    p_license: 'CC-BY-4.0',
    p_submitted_at: NOW.toISOString(),
  });
});

test('hosted adapter retains Bearer auth only for legacy service-role JWTs', async () => {
  const calls = [];
  const repository = createSupabasePublicAdmissionRepository({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'legacy.jwt.value',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, []);
    },
  });
  await repository.listSigningKeys('actor-1');
  assert.equal(calls[0].options.headers.apikey, 'legacy.jwt.value');
  assert.equal(calls[0].options.headers.authorization, 'Bearer legacy.jwt.value');
});

test('hosted adapter uses the caller token for fresh email verification and sanitizes RPC errors', async () => {
  const calls = [];
  const repository = createSupabasePublicAdmissionRepository({
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_public',
    serviceRoleKey: 'sb_secret_server',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/auth/v1/user')) return response(200, { id: 'subject-1', email_confirmed_at: '2026-08-30T00:00:00Z' });
      return response(400, { code: '23505', message: '[SIGNING_KEY_ALREADY_ACTIVE] actor already has an active signing key', details: 'private detail' });
    },
  });
  assert.equal((await repository.getAuthenticatedUser({ accessToken: 'user-jwt' })).id, 'subject-1');
  assert.equal(calls[0].options.headers.apikey, 'sb_publishable_public');
  assert.equal(calls[0].options.headers.authorization, 'Bearer user-jwt');
  await assert.rejects(
    repository.registerSigningKey({ actorId: 'actor-1', keyId: 'key-1', publicKey: PUBLIC_KEY }),
    (error) => error instanceof PublicAdmissionApiError
      && error.code === 'SIGNING_KEY_ALREADY_ACTIVE'
      && error.status === 409
      && !error.message.includes('private detail'),
  );
});

test('onboarding derives actor and auth subject from the verified session, never the body', async () => {
  const repository = admissionRepository();
  const responseValue = await jsonRequest(api(repository), '/onboarding/complete', {
    body: {
      actorId: 'actor-attacker',
      authSubject: 'subject-attacker',
      termsVersion: 'terms-2026-08-31',
      displayName: 'Ada Researcher',
    },
  });
  assert.equal(responseValue.status, 200, await responseValue.clone().text());
  const call = repository.calls.find(({ method }) => method === 'completeOnboarding');
  assert.equal(call.input.actorId, 'actor-authenticated');
  assert.equal(call.input.authSubject, 'auth-subject-1');
  assert.equal(call.input.acceptedAt, NOW.toISOString());
});

test('onboarding fails closed when the fresh Auth user is unconfirmed or belongs to another subject', async () => {
  for (const user of [
    { id: 'auth-subject-1', email_confirmed_at: null },
    { id: 'another-subject', email_confirmed_at: '2026-08-30T00:00:00Z' },
  ]) {
    const repository = admissionRepository({ getAuthenticatedUser: async () => user });
    const result = await jsonRequest(api(repository), '/onboarding/complete', {
      body: { termsVersion: 'terms-1', displayName: 'Researcher' },
    });
    assert.equal(result.status, 403);
    assert.equal((await result.json()).code, 'EMAIL_NOT_VERIFIED');
  }
});

test('signing-key routes list, register, and revoke only the authenticated Actor public key', async () => {
  const existing = { keyId: 'key-old', actorId: 'actor-authenticated', publicKey: PUBLIC_KEY, revokedAt: NOW.toISOString() };
  const repository = admissionRepository({
    listSigningKeys: async (actorId) => {
      repository.calls.push({ method: 'listSigningKeys', actorId });
      return [existing];
    },
  });
  const app = api(repository);
  const list = await app.request('/signing-keys');
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), { items: [existing] });

  const registered = await jsonRequest(app, '/signing-keys', {
    body: { actorId: 'actor-attacker', keyId: 'key-new', publicKey: PUBLIC_KEY, label: 'Laptop' },
  });
  assert.equal(registered.status, 201, await registered.clone().text());
  const registerCall = repository.calls.find(({ method }) => method === 'registerSigningKey');
  assert.equal(registerCall.input.actorId, 'actor-authenticated');
  assert.equal(registerCall.input.label, 'Laptop');
  assert.equal('privateKey' in registerCall.input, false);

  const revoked = await jsonRequest(app, '/signing-keys/key-new', { method: 'DELETE', body: { reason: 'rotated' } });
  assert.equal(revoked.status, 200, await revoked.clone().text());
  const revokeCall = repository.calls.find(({ method }) => method === 'revokeSigningKey');
  assert.equal(revokeCall.input.actorId, 'actor-authenticated');
  assert.equal(revokeCall.input.keyId, 'key-new');
});

test('project application approval stays unavailable until the Graph write gate is ready', async () => {
  const repository = admissionRepository();
  const app = api(repository, { actor: { actorId: 'steward-1', actorType: 'maintainer' }, actorId: 'steward-1' });
  const result = await jsonRequest(app, '/project-applications/application-1/decision', {
    body: { decision: 'approved', reason: 'Meets the public-project policy.' },
  });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).code, 'PROJECT_APPROVAL_GRAPH_WRITE_NOT_READY');
  assert.equal(repository.calls.some(({ method }) => method === 'decideProjectApplication'), false);
});

test('applications and invitations pin applicant, inviter, and recipient to the session Actor', async () => {
  const repository = admissionRepository();
  const app = api(repository);
  const projectId = 'project_018f6ab0-4e39-7b71-8db5-84451b7c3a21';
  const application = await jsonRequest(app, '/project-applications', {
    body: { actorId: 'actor-attacker', proposedProjectId: projectId, name: 'Project', summary: 'Summary', license: 'CC-BY-4.0' },
  });
  assert.equal(application.status, 201, await application.clone().text());
  assert.equal(repository.calls.find(({ method }) => method === 'submitProjectApplication').input.applicantActorId, 'actor-authenticated');

  const invitation = await jsonRequest(app, `/projects/${projectId}/invitations`, {
    body: { invitedActorId: 'actor-invitee', role: 'contributor', expiresAt: '2026-09-10T00:00:00Z', invitedByActorId: 'actor-attacker' },
  });
  assert.equal(invitation.status, 201, await invitation.clone().text());
  const inviteCall = repository.calls.find(({ method }) => method === 'createProjectInvitation');
  assert.equal(inviteCall.input.invitedByActorId, 'actor-authenticated');
  assert.deepEqual(repository.calls.find(({ method }) => method === 'getProjectRole'), {
    method: 'getProjectRole', projectId, actorId: 'actor-authenticated',
  });

  const responseValue = await jsonRequest(app, '/project-invitations/invitation-1/respond', {
    body: { invitedActorId: 'actor-attacker', response: 'accepted' },
  });
  assert.equal(responseValue.status, 200, await responseValue.clone().text());
  assert.equal(repository.calls.find(({ method }) => method === 'respondToProjectInvitation').input.invitedActorId, 'actor-authenticated');
});

test('membership mutation derives manager identity and role server-side', async () => {
  const repository = admissionRepository();
  const app = api(repository);
  const projectId = 'project_018f6ab0-4e39-7b71-8db5-84451b7c3a21';
  const changed = await jsonRequest(app, `/projects/${projectId}/members/actor-target`, {
    method: 'PATCH',
    body: { actorId: 'actor-attacker', role: 'maintainer', reason: 'Taking coordination duty.' },
  });
  assert.equal(changed.status, 200, await changed.clone().text());
  const call = repository.calls.find(({ method }) => method === 'changeProjectMembershipRole');
  assert.equal(call.input.changedByActorId, 'actor-authenticated');
  assert.equal(call.input.targetActorId, 'actor-target');
  assert.equal(call.input.changerRole, undefined);
  assert.equal(call.input.role, 'maintainer');
});

test('invalid JSON is an explicit error and never rendered as empty data', async () => {
  const app = api(admissionRepository());
  const result = await app.request('/project-applications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(result.status, 400);
  assert.deepEqual(await result.json(), {
    code: 'invalid_json',
    message: 'request body must be valid JSON',
    request_id: 'request-test',
  });
});

test('createApp wires admission routes to Supabase claims and the dedicated service repository', async () => {
  const publicAdmissionRepository = admissionRepository();
  const readRepository = {
    findIdentity: async (provider, subject) => provider === 'supabase' && subject === 'auth-subject-1'
      ? { actorId: 'actor-authenticated' }
      : null,
    getActor: async (actorId) => actorId === 'actor-authenticated'
      ? { actorId, actorType: 'human' }
      : null,
  };
  const app = createApp({
    repository: readRepository,
    publicAdmissionRepository,
    authenticate: async () => ({ sub: 'auth-subject-1', email: 'researcher@example.test' }),
  });
  const result = await app.fetch(new Request('https://api.example.test/project-applications', {
    method: 'POST',
    headers: { authorization: 'Bearer user-jwt', 'content-type': 'application/json' },
    body: JSON.stringify({
      applicantActorId: 'actor-attacker',
      proposedProjectId: 'project_018f6ab0-4e39-7b71-8db5-84451b7c3a21',
      name: 'Public project',
      summary: 'A traceable public research project.',
      license: 'CC-BY-4.0',
    }),
  }), {});
  assert.equal(result.status, 201, await result.clone().text());
  assert.equal(
    publicAdmissionRepository.calls.find(({ method }) => method === 'submitProjectApplication').input.applicantActorId,
    'actor-authenticated',
  );
});
