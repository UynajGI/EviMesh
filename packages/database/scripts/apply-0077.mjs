/* Apply (or dry-run) migration 0077 to the hosted production Postgres.
 *
 * Usage:  node scripts/apply-0077.mjs [--dry-run]
 *
 * Reads drizzle/0077_salty_ultron.sql, splits on the statement-breakpoint
 * marker, executes inside one transaction, verifies the expected objects,
 * and commits (or rolls back with --dry-run). Never touches
 * drizzle.__drizzle_migrations — the hosted database does not carry that
 * table and must never replay from 0000.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import postgres from 'postgres';

const dryRun = process.argv.includes('--dry-run');
const here = path.dirname(url.fileURLToPath(import.meta.url));
const sqlPath = path.join(here, '..', 'drizzle', '0077_salty_ultron.sql');
const password = process.env.EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD;
if (!password) {
  console.error('EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD is required');
  process.exit(2);
}

const dsn = `postgres://postgres.rruhruccjnuffodfbkuh:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`;
const sql = postgres(dsn, { ssl: 'prefer', max: 1, idle_timeout: 10 });

const raw = fs.readFileSync(sqlPath, 'utf8');
const statements = raw
  .split('--> statement-breakpoint')
  .map((chunk) => chunk.trim())
  .filter((chunk) => chunk.length > 0 && !chunk.startsWith('-- only'));

const preflight = await sql`
  SELECT
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('engagement_interactions', 'recommendation_cache'))::int AS new_tables,
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'actors' AND column_name = 'auth_subject')::int AS auth_subject,
    (SELECT count(*) FROM pg_namespace WHERE nspname = 'auth')::int AS auth_schema
`;
console.log('preflight:', preflight[0]);
if (preflight[0].new_tables > 0 || preflight[0].auth_subject > 0) {
  console.error('migration 0077 appears to be already applied; aborting');
  process.exit(1);
}
if (preflight[0].auth_schema !== 1) {
  console.error('auth schema missing: the RLS guard expects hosted Supabase; aborting');
  process.exit(1);
}

class DryRunOk extends Error {}

try {
  await sql.begin(async (tx) => {
    for (const [index, statement] of statements.entries()) {
      const label = statement.split('\n')[0].slice(0, 72);
      process.stdout.write(`  ${String(index + 1).padStart(2, '0')}/${statements.length} ${label}… `);
      await tx.unsafe(statement);
      console.log('ok');
    }
    const check = await tx`
      SELECT
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('engagement_interactions', 'recommendation_cache'))::int AS new_tables,
        (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'actors' AND column_name = 'auth_subject')::int AS auth_subject,
        (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN ('engagement_interactions_own', 'recommendation_cache_read_own', 'identities_own_subject', 'actors_read_directory', 'actors_insert_self'))::int AS policies
    `;
    console.log('post-apply check:', check[0]);
    if (check[0].new_tables !== 2 || check[0].auth_subject !== 1 || check[0].policies !== 5) {
      throw new Error('verification failed: expected 2 tables, the auth_subject column, and 5 policies');
    }
    /* postgres.js commits when the callback resolves; roll a dry run back by
     * unwinding with a sentinel error instead. */
    if (dryRun) throw new DryRunOk();
  });
  if (!dryRun) console.log('migration 0077 applied and committed');
} catch (error) {
  if (error instanceof DryRunOk) {
    console.log('DRY RUN OK — transaction rolled back, nothing persisted');
  } else {
    throw error;
  }
} finally {
  await sql.end({ timeout: 5 });
}
