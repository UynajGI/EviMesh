import assert from 'node:assert/strict';
import test from 'node:test';
import postgres from 'postgres';

const databaseUrl = process.env.EVIMESH_TEST_DATABASE_URL;
const rollback = new Error('rollback event guard fixture');

test('an ordinary application role cannot DELETE a persisted research event', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    try {
      await sql.begin(async (transaction) => {
        const [adminRole] = await transaction`
          select r.rolsuper
          from pg_roles as r
          where r.rolname = current_user
        `;
        assert.equal(adminRole.rolsuper, true, 'the integration URL must provision the disposable application role');
        await transaction.unsafe('create role evimesh_event_guard_test nologin');
        await transaction.unsafe('grant usage on schema public to evimesh_event_guard_test');
        await transaction.unsafe('grant select, insert, delete on public.research_events to evimesh_event_guard_test');
        await transaction.unsafe(`
          create policy event_guard_test_write on public.research_events
          for all to evimesh_event_guard_test
          using (true) with check (true)
        `);
        await transaction.unsafe('set local role evimesh_event_guard_test');
        const [applicationRole] = await transaction`
          select r.rolsuper
          from pg_roles as r
          where r.rolname = current_user
        `;
        assert.equal(applicationRole.rolsuper, false);

        const eventId = '018f0f4a-5c00-7000-8000-000000000026';
        await transaction`
          insert into research_events (event_id, event_type, payload, hash, signature, parents)
          values (
            ${eventId},
            'claim.created',
            ${JSON.stringify({ claim_id: 'claim_event_guard' })}::jsonb,
            ${`sha256:${'a'.repeat(64)}`},
            ${JSON.stringify({ algorithm: 'Ed25519', key_id: 'test_key', value: 'test_signature' })}::jsonb,
            ${JSON.stringify([])}::jsonb
          )
        `;

        const failure = await transaction.savepoint((savepoint) => savepoint`
          delete from research_events where event_id = ${eventId}
        `).then(() => null, (error) => error);
        assert.ok(failure, 'DELETE must be rejected by the append-only trigger');
        assert.equal(failure.code, '55000');
        assert.match(failure.message, /research_events are append-only; DELETE is not allowed/);

        const [persisted] = await transaction`
          select event_id from research_events where event_id = ${eventId}
        `;
        assert.equal(persisted.event_id, eventId);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  } finally {
    await sql.end();
  }
});
