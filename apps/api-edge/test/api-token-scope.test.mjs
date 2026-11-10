import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_TOKEN_SCOPES,
  ApiTokenAuthorizationError,
  apiTokenRoutePolicy,
  assertApiTokenScope,
  isLegacyResearchMutationRoute,
  normalizeRegisteredApiTokenScopes,
} from '../src/api-token-scope.mjs';

test('the API token registry is exactly the Device Authorization registry', () => {
  assert.deepEqual(API_TOKEN_SCOPES, [
    'profile:read',
    'project:read',
    'research:prepare',
    'research:submit',
    'artifact:upload',
  ]);
  assert.deepEqual(normalizeRegisteredApiTokenScopes(['research:submit', 'profile:read', 'profile:read']), [
    'profile:read',
    'research:submit',
  ]);
});

test('unknown scopes and research:sign are invalid credentials', () => {
  for (const scope of ['claim:read', 'task:read', 'research:sign']) {
    assert.throws(
      () => normalizeRegisteredApiTokenScopes([scope]),
      (error) => error instanceof ApiTokenAuthorizationError
        && error.code === 'API_TOKEN_INVALID_SCOPES'
        && error.status === 401,
    );
  }
});

test('scope guards return a typed 403 and never grant by implication', () => {
  assert.throws(
    () => assertApiTokenScope({ kind: 'api_token', scopes: ['profile:read'] }, 'project:read'),
    (error) => error instanceof ApiTokenAuthorizationError
      && error.code === 'API_TOKEN_SCOPE_FORBIDDEN'
      && error.status === 403,
  );
  assert.equal(assertApiTokenScope({ kind: 'api_token', scopes: ['project:read'] }, 'project:read'), true);
});

test('API token routes are explicit and deny by default', () => {
  const matrix = [
    ['GET', '/auth/me', { scope: 'profile:read' }],
    ['GET', '/questions', { scope: 'project:read' }],
    ['GET', '/research-graph/question/q-1/neighborhood', { scope: 'project:read' }],
    ['POST', '/answers/prepare', { scope: 'research:prepare' }],
    ['POST', '/answers', { scope: 'research:submit' }],
    ['POST', '/artifacts/upload-plan', { scope: 'artifact:upload' }],
  ];
  for (const [method, path, expected] of matrix) {
    assert.deepEqual(apiTokenRoutePolicy(method, path), expected, `${method} ${path}`);
  }
  assert.equal(apiTokenRoutePolicy('GET', '/api-tokens').code, 'API_TOKEN_SESSION_REQUIRED');
  assert.equal(apiTokenRoutePolicy('POST', '/signing-keys').code, 'API_TOKEN_ROUTE_FORBIDDEN');
  assert.equal(apiTokenRoutePolicy('POST', '/claims').code, 'API_TOKEN_ROUTE_FORBIDDEN');
  assert.equal(apiTokenRoutePolicy('GET', '/not-a-route').code, 'API_TOKEN_ROUTE_FORBIDDEN');
});

test('public product mode recognizes every legacy direct research mutation family', () => {
  for (const path of [
    '/witness-receipts',
    '/projects',
    '/questions',
    '/tasks/task-1/lease',
    '/claims/claim-1/revisions',
    '/attempts/attempt-1/trace',
    '/evidence',
    '/runs',
    '/artifacts',
    '/verifications/prepare',
    '/challenges/challenge-1/transitions',
  ]) {
    assert.equal(isLegacyResearchMutationRoute('POST', path), true, path);
  }
  assert.equal(isLegacyResearchMutationRoute('POST', '/artifacts/upload-plan'), false);
  assert.equal(isLegacyResearchMutationRoute('GET', '/claims'), false);
  assert.equal(isLegacyResearchMutationRoute('POST', '/answers/prepare'), false);
  for (const [method, path] of [
    ['POST', '/projects/project_1/agents'],
    ['DELETE', '/projects/project_1/agents/agent_1'],
    ['POST', '/projects/project_1/invitations'],
    ['POST', '/projects/project_1/invitations/inv_1/revoke'],
    ['PATCH', '/projects/project_1/members/actor_1'],
    ['DELETE', '/projects/project_1/members/actor_1'],
  ]) {
    assert.equal(isLegacyResearchMutationRoute(method, path), false, `${method} ${path}`);
  }
  assert.equal(isLegacyResearchMutationRoute('POST', '/projects'), true);
  assert.equal(isLegacyResearchMutationRoute('POST', '/projects/project_1/frontier'), true);
});
