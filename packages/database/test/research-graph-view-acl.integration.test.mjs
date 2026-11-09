import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import postgres from 'postgres';

const databaseUrl = process.env.EVIMESH_TEST_DATABASE_URL;
const rollback = new Error('rollback research Graph view ACL fixture');
const migration = await readFile(
  new URL('../drizzle/0084_graph_view_authenticated_read_only.sql', import.meta.url),
  'utf8',
);

const publicResearchViews = [
  'research_graph_nodes',
  'research_graph_edges',
  'research_answers',
  'research_rebuttals',
  'research_evaluations',
  'research_evaluation_bases',
  'research_datasets',
  'research_tools',
];

async function readPrivileges(transaction, view) {
  const relation = `public.${view}`;
  const [privileges] = await transaction`
    SELECT
      has_table_privilege('authenticated', ${relation}, 'SELECT') AS "canSelect",
      has_table_privilege('authenticated', ${relation}, 'INSERT') AS "canInsert",
      has_table_privilege('authenticated', ${relation}, 'UPDATE') AS "canUpdate",
      has_table_privilege('authenticated', ${relation}, 'DELETE') AS "canDelete",
      has_table_privilege('authenticated', ${relation}, 'TRUNCATE') AS "canTruncate",
      has_table_privilege('authenticated', ${relation}, 'REFERENCES') AS "canReference",
      has_table_privilege('authenticated', ${relation}, 'TRIGGER') AS "canTrigger"
  `;
  return privileges;
}

test('authenticated has SELECT and no mutation privilege on every public Graph view', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    try {
      await sql.begin(async (transaction) => {
        const [adminRole] = await transaction`
          SELECT rolsuper FROM pg_roles WHERE rolname = current_user
        `;
        assert.equal(adminRole.rolsuper, true, 'the integration URL must provision a disposable superuser');

        const [authenticatedRole] = await transaction`
          SELECT rolname FROM pg_roles WHERE rolname = 'authenticated'
        `;
        if (!authenticatedRole) await transaction.unsafe('CREATE ROLE authenticated NOLOGIN');

        for (const view of publicResearchViews) {
          const [relation] = await transaction`
            SELECT n.nspname || '.' || c.relname AS "relationName"
            FROM pg_catalog.pg_class AS c
            JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
            WHERE c.oid = to_regclass(${`public.${view}`})
          `;
          // Schema-qualify explicitly: regclass::text omits public when it is on search_path.
          assert.equal(relation?.relationName, `public.${view}`, `missing public Graph view: ${view}`);
        }

        await transaction.unsafe(`
          GRANT ALL ON TABLE
            public.research_graph_nodes,
            public.research_graph_edges,
            public.research_answers,
            public.research_rebuttals,
            public.research_evaluations,
            public.research_evaluation_bases,
            public.research_datasets,
            public.research_tools
          TO authenticated
        `);

        for (const view of publicResearchViews) {
          const before = await readPrivileges(transaction, view);
          assert.equal(before.canSelect, true);
          assert.equal(before.canInsert, true);
          assert.equal(before.canUpdate, true);
          assert.equal(before.canDelete, true);
        }

        await transaction.unsafe(migration);

        for (const view of publicResearchViews) {
          const after = await readPrivileges(transaction, view);
          assert.deepEqual(after, {
            canSelect: true,
            canInsert: false,
            canUpdate: false,
            canDelete: false,
            canTruncate: false,
            canReference: false,
            canTrigger: false,
          });
        }

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  } finally {
    await sql.end();
  }
});
