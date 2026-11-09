import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicAdmissionRepository, PublicAdmissionRepositoryError } from '../src/public-admission-repository.mjs';

function fakeSql({ role = 'service_role' } = {}) {
  const calls = [];
  const tx = {
    async unsafe(query, values = []) {
      calls.push({ query, values });
      if (query.includes('current_role')) return [{ currentRole: role }];
      if (query.startsWith('SELECT "public"')) return [{ result: { ok: true, query, values } }];
      return [];
    },
  };
  const sql = () => {};
  sql.calls = calls;
  sql.begin = async (callback) => callback(tx);
  return sql;
}

test('repository pins service_role and invokes only fixed RPC names', async () => {
  const sql = fakeSql();
  const repository = createPublicAdmissionRepository(sql);
  assert.equal(repository.projectApprovalGraphWriteReady, false);
  const result = await repository.submitProjectApplication({
    applicantActorId: 'actor-1',
    proposedProjectId: 'project-1',
    name: 'Project',
    summary: 'Summary',
    license: 'CC-BY-4.0',
    submittedAt: '2026-08-31T00:00:00Z',
  });

  assert.equal(sql.calls[0].query, 'SET LOCAL ROLE service_role');
  assert.match(result.query, /"public"\."project_application_submit"\(\$1, \$2, \$3, \$4, \$5, \$6\)/);
  assert.deepEqual(result.values, ['actor-1', 'project-1', 'Project', 'Summary', 'CC-BY-4.0', '2026-08-31T00:00:00Z']);
});

test('repository fails closed when the transaction is not service_role', async () => {
  const repository = createPublicAdmissionRepository(fakeSql({ role: 'authenticated' }));
  await assert.rejects(
    repository.listSigningKeys('actor-1'),
    (error) => error instanceof PublicAdmissionRepositoryError && error.code === 'PUBLIC_ADMISSION_SERVICE_ROLE_REQUIRED',
  );
});
