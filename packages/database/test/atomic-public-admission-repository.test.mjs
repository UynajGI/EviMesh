import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AtomicPublicAdmissionRepositoryError,
  createAtomicPublicAdmissionRepository,
} from '../src/atomic-public-admission-repository.mjs';

function sqlFixture({ results = [], error = null, role = 'service_role' } = {}) {
  const calls = [];
  let resultIndex = 0;
  const transaction = {
    async unsafe(statement, values = []) {
      calls.push([statement, values]);
      if (statement.startsWith('SELECT current_role')) return [{ currentRole: role }];
      if (statement.startsWith('SELECT public.') && error) throw error;
      if (statement.startsWith('SELECT public.')) return [{ result: results[resultIndex++] }];
      return [];
    },
  };
  const sql = Object.assign(() => {}, { begin: async (callback) => callback(transaction) });
  return { sql, calls };
}

const claims = Object.freeze({
  schema: 'evimesh.auth-bootstrap-claims.v1',
  source: 'supabase_auth_admin',
  authSubject: '018f0f4a-5c00-7000-8000-000000000001',
  email: 'researcher@example.org',
  emailConfirmedAt: '2026-08-31T00:00:00.000Z',
  identities: [],
});

const decision = Object.freeze({
  applicationId: '018f0f4a-5c00-7000-8000-000000000010',
  stewardActorId: 'steward-1',
  decision: 'approved',
  reason: 'eligible open research project',
  decidedAt: '2026-08-31T00:00:00.000Z',
  platformActorId: 'platform-governance',
  platformEvent: { schema: 'srp.event.v1' },
});

test('Human bootstrap assumes service_role and calls one fixed jsonb RPC', async () => {
  const expected = { schema: 'evimesh.actor-bootstrap-result.v1', actorId: 'actor-1' };
  const { sql, calls } = sqlFixture({ results: [expected] });
  const repository = createAtomicPublicAdmissionRepository(sql);
  assert.deepEqual(await repository.bootstrapHumanActor({ authoritativeClaims: claims }), expected);
  assert.deepEqual(calls, [
    ['SET LOCAL ROLE service_role', []],
    ['SELECT current_role::text AS "currentRole"', []],
    ['SELECT public.actor_self_bootstrap($1::jsonb) AS result', [claims]],
  ]);
  assert.equal(repository.actorBootstrapReady, true);
});

test('project decision is one seven-argument atomic RPC with platform governance attribution', async () => {
  const expected = { schema: 'evimesh.project-application-decision-result.v1', status: 'approved' };
  const { sql, calls } = sqlFixture({ results: [expected] });
  const repository = createAtomicPublicAdmissionRepository(sql);
  assert.deepEqual(await repository.decideProjectApplicationAtomic(decision), expected);
  assert.deepEqual(calls.map(([statement]) => statement), [
    'SET LOCAL ROLE service_role',
    'SELECT current_role::text AS "currentRole"',
    'SELECT public.project_application_decide_atomic($1::uuid,$2::text,$3::text,$4::text,$5::timestamptz,$6::text,$7::jsonb) AS result',
  ]);
  assert.deepEqual(calls[2][1], [
    decision.applicationId,
    decision.stewardActorId,
    decision.decision,
    decision.reason,
    decision.decidedAt,
    decision.platformActorId,
    decision.platformEvent,
  ]);
  assert.equal(repository.atomicProjectDecisionReady, true);
  assert.equal(repository.usesPlatformGovernanceEvent, true);
  assert.equal('insertProject' in repository, false);
  assert.equal('linkIdentity' in repository, false);
});

test('stable database conflicts and authorization failures map to API-safe status codes', async () => {
  for (const [message, code, status] of [
    ['[ACTOR_BOOTSTRAP_IDENTITY_CONFLICT] provider subject belongs elsewhere', 'ACTOR_BOOTSTRAP_IDENTITY_CONFLICT', 409],
    ['[PROJECT_APPLICATION_STEWARD_FORBIDDEN] steward required', 'PROJECT_APPLICATION_STEWARD_FORBIDDEN', 403],
    ['[PROJECT_APPLICATION_NOT_FOUND] missing', 'PROJECT_APPLICATION_NOT_FOUND', 404],
    ['[PROJECT_APPLICATION_PLATFORM_EVENT_MISMATCH] altered payload', 'PROJECT_APPLICATION_PLATFORM_EVENT_MISMATCH', 400],
    ['unclassified database failure', 'ATOMIC_PUBLIC_ADMISSION_DATABASE_ERROR', 500],
  ]) {
    const { sql } = sqlFixture({ error: new Error(message) });
    const repository = createAtomicPublicAdmissionRepository(sql);
    await assert.rejects(
      repository.bootstrapHumanActor({ authoritativeClaims: claims }),
      (error) => error instanceof AtomicPublicAdmissionRepositoryError
        && error.code === code && error.status === status,
    );
  }
});

test('invalid inputs and a role-assumption failure stop before any mutation RPC', async () => {
  const { sql, calls } = sqlFixture({ role: 'authenticated' });
  const repository = createAtomicPublicAdmissionRepository(sql);
  await assert.rejects(
    repository.bootstrapHumanActor({ authoritativeClaims: null }),
    (error) => error.code === 'ATOMIC_PUBLIC_ADMISSION_INPUT_INVALID' && error.status === 400,
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    repository.decideProjectApplicationAtomic(decision),
    (error) => error.code === 'ATOMIC_PUBLIC_ADMISSION_SERVICE_ROLE_REQUIRED' && error.status === 403,
  );
  assert.deepEqual(calls.map(([statement]) => statement), [
    'SET LOCAL ROLE service_role',
    'SELECT current_role::text AS "currentRole"',
  ]);
});

test('RPC result schemas fail closed instead of accepting partial database responses', async () => {
  const { sql } = sqlFixture({ results: [{ actorId: 'actor-without-schema' }] });
  const repository = createAtomicPublicAdmissionRepository(sql);
  await assert.rejects(
    repository.bootstrapHumanActor({ authoritativeClaims: claims }),
    (error) => error.code === 'ATOMIC_PUBLIC_ADMISSION_REPOSITORY_INVALID' && error.status === 500,
  );
});
