import assert from 'node:assert/strict';
import test from 'node:test';
import postgres from 'postgres';

const databaseUrl = process.env.EVIMESH_TEST_DATABASE_URL;
const rollback = new Error('rollback revision guard fixture');

test('an ordinary application role cannot UPDATE a persisted Claim revision', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    try {
      await sql.begin(async (transaction) => {
        const [adminRole] = await transaction`
          select r.rolsuper from pg_roles as r where r.rolname = current_user
        `;
        assert.equal(adminRole.rolsuper, true, 'the integration URL must provision the disposable application role');

        const actorId = 'actor_revision_guard';
        const claimId = 'claim_revision_guard';
        await transaction`
          insert into actors (actor_id, actor_type) values (${actorId}, 'service')
        `;
        await transaction`
          insert into claims (claim_id, state, created_by)
          values (${claimId}, 'hypothesis', ${actorId})
        `;
        await transaction`
          insert into claim_revisions (
            claim_id, revision, supersedes, state, statement, scope, assumptions, falsification, created_by
          ) values (
            ${claimId}, 1, null, 'hypothesis', 'Original immutable claim.',
            ${JSON.stringify({ population: 'adults' })}::jsonb,
            ${JSON.stringify(['randomized'])}::jsonb,
            ${JSON.stringify({ threshold: 0 })}::jsonb,
            ${actorId}
          )
        `;

        await transaction.unsafe('create role evimesh_revision_guard_test nologin');
        await transaction.unsafe('grant usage on schema public to evimesh_revision_guard_test');
        await transaction.unsafe('grant select, update on public.claim_revisions to evimesh_revision_guard_test');
        await transaction.unsafe(`
          create policy revision_guard_test_write on public.claim_revisions
          for all to evimesh_revision_guard_test
          using (true) with check (true)
        `);
        await transaction.unsafe('set local role evimesh_revision_guard_test');
        const [applicationRole] = await transaction`
          select r.rolsuper from pg_roles as r where r.rolname = current_user
        `;
        assert.equal(applicationRole.rolsuper, false);

        const failure = await transaction.savepoint((savepoint) => savepoint`
          update claim_revisions
          set statement = 'Tampered mutable claim.'
          where claim_id = ${claimId} and revision = 1
        `).then(() => null, (error) => error);
        assert.ok(failure, 'UPDATE must be rejected by the append-only trigger');
        assert.equal(failure.code, '55000');
        assert.match(failure.message, /claim_revisions is append-only; UPDATE is not allowed/);

        const [persisted] = await transaction`
          select statement from claim_revisions where claim_id = ${claimId} and revision = 1
        `;
        assert.equal(persisted.statement, 'Original immutable claim.');
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  } finally {
    await sql.end();
  }
});
