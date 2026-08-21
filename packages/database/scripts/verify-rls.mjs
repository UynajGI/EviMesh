/* Row-level-security end-to-end verification against the production
 * database: simulates the PostgREST caller (SET ROLE + request.jwt.claims)
 * and asserts the 0077 policy set actually pins row ownership.
 *
 * Usage: node scripts/verify-rls.mjs
 * Leaves nothing behind (transaction + explicit cleanup).
 *
 * Note: denial probes MUST run through tx.savepoint() — postgres.js marks
 * a transaction failed if any statement inside sql.begin() errors, even
 * when the statement was expected and savepoint-recovered.
 */
import postgres from 'postgres';

const password = process.env.EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD;
if (!password) {
  console.error('EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD is required');
  process.exit(2);
}
const sql = postgres(`postgres://postgres.rruhruccjnuffodfbkuh:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`, { ssl: 'prefer', max: 1 });

const A = 'actor_rls_a_20260821';
const B = 'actor_rls_b_20260821';
/* auth.uid() returns uuid: the policies compare it as text, so the seeded
 * subjects must be uuid-shaped like real Supabase subs. */
const SUB_A = '00000000-0000-4000-8000-00000000000a';
const SUB_B = '00000000-0000-4000-8000-00000000000b';

async function asRole(tx, subject, statements) {
  /* PostgREST model: the authenticated role with the caller's JWT claims. */
  await tx.unsafe(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: subject, role: 'authenticated' })]);
  await tx.unsafe('SET LOCAL ROLE authenticated');
  return statements();
}

async function expectDenied(tx, buildStatement, label) {
  try {
    /* The statement must run on the savepoint's own client: postgres.js
     * tracks per-scope uncaught errors, and routing it through the outer
     * tx would poison the enclosing transaction's bookkeeping. */
    await tx.savepoint(async (sp) => {
      await buildStatement(sp);
    });
  } catch (error) {
    if (String(error.code) === '42501' || /row-level security/i.test(error.message ?? '')) {
      console.log(`  ok (denied): ${label}`);
      return;
    }
    throw error;
  }
  throw new Error(`RLS FAILED — operation was allowed: ${label}`);
}

let failures = 0;
try {
  /* Seed as table owner: two actors, one binding each, one cache row each. */
  await sql`DELETE FROM actors WHERE actor_id IN (${A}, ${B})`;
  await sql`INSERT INTO actors (actor_id, actor_type, identity_strength, auth_subject) VALUES (${A}, 'human', 'self_declared', ${SUB_A}), (${B}, 'human', 'self_declared', ${SUB_B})`;
  await sql`INSERT INTO identities (actor_id, provider, subject) VALUES (${A}, 'supabase', ${SUB_A}), (${B}, 'supabase', ${SUB_B})`;
  await sql`INSERT INTO recommendation_cache (id, actor_id, object_type, object_id, rank, model) VALUES ('rc-rls-a', ${A}, 'question', 'q-rls', 1, 'implicit-itemitem'), ('rc-rls-b', ${B}, 'question', 'q-rls', 1, 'implicit-itemitem')`;

  await sql.begin(async (tx) => {
    await asRole(tx, SUB_A, async () => {
      const own = await tx`INSERT INTO engagement_interactions (interaction_id, actor_id, object_type, object_id, kind) VALUES ('itx-rls-a', ${A}, 'question', 'q-rls', 'helpful') RETURNING interaction_id`;
      console.log(`  ok (allowed): own-row interaction insert (${own.length} row)`);

      await expectDenied(tx, (sp) => sp`INSERT INTO engagement_interactions (interaction_id, actor_id, object_type, object_id, kind) VALUES ('itx-rls-hijack', ${B}, 'question', 'q-rls', 'helpful')`, 'interaction insert for ANOTHER actor');

      const visible = await tx`SELECT actor_id FROM recommendation_cache`;
      console.log(`  cache visibility: ${visible.length} row(s), all own = ${visible.every((row) => row.actor_id === A)}`);
      if (visible.length !== 1 || visible[0].actor_id !== A) throw new Error('RLS FAILED — cache leak across actors');

      await expectDenied(tx, (sp) => sp`INSERT INTO identities (actor_id, provider, subject) VALUES (${B}, 'supabase', ${SUB_B})`, 'identity insert onto ANOTHER subject-pinned actor');
    });
  });
  console.log('  authenticated-role transaction committed and closed');
  await sql.begin(async (tx) => {
    await tx.unsafe('SET LOCAL ROLE anon');
    const identityRows = await tx`SELECT count(*)::int AS n FROM identities`;
    const actorRows = await tx`SELECT count(*)::int AS n FROM actors WHERE actor_id IN (${A}, ${B})`;
    console.log(`  anon: identities visible=${identityRows[0].n} (expect 0), actor directory visible=${actorRows[0].n} (expect 2)`);
    if (identityRows[0].n !== 0) throw new Error('RLS FAILED — anon can read identities');
    if (actorRows[0].n !== 2) throw new Error('RLS FAILED — anon lost the actor directory');
  });
} catch (error) {
  failures += 1;
  console.error('VERIFY FAILED:', error.message, '| code:', error.code ?? '-');
} finally {
  await sql`DELETE FROM actors WHERE actor_id IN (${A}, ${B})`;
  const leftover = await sql`SELECT count(*)::int AS n FROM engagement_interactions WHERE actor_id IN (${A}, ${B})`;
  await sql.end({ timeout: 5 });
  console.log(`cleanup done (leftover interactions: ${leftover[0].n})`);
}
process.exit(failures === 0 ? 0 : 1);
