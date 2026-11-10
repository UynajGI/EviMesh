/* READ-ONLY production preflight for migrations 0084-0090. No writes. */
import postgres from 'postgres';
const password = process.env.EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD;
const sql = postgres(`postgres://postgres.rruhruccjnuffodfbkuh:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`, { ssl: 'prefer', max: 1, idle_timeout: 5, connect_timeout: 20 });
try {
  await sql`SET TRANSACTION READ ONLY`.catch(() => {});
  const [row] = await sql`
    SELECT
      to_regclass('private.device_authorizations') IS NOT NULL AS m0085,
      to_regclass('private.project_applications') IS NOT NULL AS m0086,
      to_regclass('private.api_token_audit_events') IS NOT NULL AS m0087,
      to_regclass('private.research_submission_receipts') IS NOT NULL AS m0088,
      to_regclass('private.project_application_decision_receipts') IS NOT NULL AS m0089,
      to_regprocedure('public.managed_agent_create(text,text,text,text)') IS NOT NULL OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='managed_agent_create') AS m0090,
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='api_tokens' AND column_name='label')::int AS api_tokens_label,
      (SELECT count(*) FROM public.api_tokens)::int AS api_tokens_rows,
      (SELECT count(*) FROM public.signing_keys)::int AS signing_keys_rows,
      (SELECT count(*) FROM public.actors)::int AS actors_rows,
      (SELECT count(*) FROM public.project_members)::int AS members_rows,
      (SELECT count(*) FROM pg_namespace WHERE nspname='private')::int AS private_schema
  `;
  console.log(row);
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('api_tokens','signing_keys') ORDER BY table_name, ordinal_position`;
  console.log(cols.map((c) => c.column_name + ':' + c.data_type).join(', '));
} finally {
  await sql.end({ timeout: 5 });
}
