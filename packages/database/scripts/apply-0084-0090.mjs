/* Apply (or dry-run) migrations 0084 and 0086-0090 to hosted production.
 *
 * Usage:  node scripts/apply-0084-0090.mjs [--dry-run]
 *
 * Production already carries 0085 (device authorization). Each migration runs
 * in its own transaction, split on statement-breakpoint markers, with
 * search_path = public, extensions (as in rehearsal). A dry run applies every
 * file inside ONE transaction and rolls it back, so later files see earlier
 * ones without persisting anything. Never touches drizzle.__drizzle_migrations.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import postgres from 'postgres';

const dryRun = process.argv.includes('--dry-run');
const here = path.dirname(url.fileURLToPath(import.meta.url));
const files = [
  '0084_graph_view_authenticated_read_only.sql',
  '0086_brainy_callisto.sql',
  '0087_true_bucky.sql',
  '0088_atomic_typed_research_submit.sql',
  '0089_atomic_public_identity_and_project_admission.sql',
  '0090_public_write_loop.sql',
];
const password = process.env.EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD;
if (!password) { console.error('EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD is required'); process.exit(2); }
const sql = postgres(`postgres://postgres.rruhruccjnuffodfbkuh:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`, { ssl: 'prefer', max: 1, idle_timeout: 10, onnotice: () => {} });

const statementsOf = (file) => fs.readFileSync(path.join(here, '..', 'drizzle', file), 'utf8')
  .split('--> statement-breakpoint').map((chunk) => chunk.trim()).filter(Boolean);

const [pre] = await sql`SELECT to_regclass('private.device_authorizations') IS NOT NULL AS has0085, to_regclass('private.project_applications') IS NOT NULL AS has0086`;
console.log('preflight:', pre);
if (!pre.has0085 || pre.has0086) { console.error('unexpected production state; aborting'); await sql.end(); process.exit(1); }

class DryRunOk extends Error {}
const verify = async (tx) => {
  const [row] = await tx`SELECT
    to_regclass('private.project_applications') IS NOT NULL AS m0086,
    to_regclass('private.api_token_audit_events') IS NOT NULL AS m0087,
    to_regclass('private.research_submission_receipts') IS NOT NULL AS m0088,
    to_regclass('private.project_application_decision_receipts') IS NOT NULL AS m0089,
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'managed_agent_create') AS m0090`;
  console.log('post-apply check:', row);
  if (!Object.values(row).every(Boolean)) throw new Error('verification failed');
};

try {
  if (dryRun) {
    await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path = public, extensions');
      for (const file of files) { for (const statement of statementsOf(file)) await tx.unsafe(statement); console.log('ok  ', file); }
      await verify(tx);
      throw new DryRunOk();
    });
  } else {
    for (const file of files) {
      await sql.begin(async (tx) => {
        await tx.unsafe('SET LOCAL search_path = public, extensions');
        for (const statement of statementsOf(file)) await tx.unsafe(statement);
      });
      console.log('committed', file);
    }
    await sql.begin(verify);
  }
} catch (error) {
  if (error instanceof DryRunOk) console.log('DRY RUN OK: rolled back, nothing persisted');
  else { console.error('FAILED:', error.message); process.exitCode = 1; }
} finally {
  await sql.end({ timeout: 5 });
}
