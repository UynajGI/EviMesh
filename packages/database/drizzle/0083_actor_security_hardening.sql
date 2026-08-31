-- Keep the public actor directory readable without exposing the Supabase
-- subject binding.  The base table remains a service-owned provisioning
-- surface; browser roles only receive the explicit projection below.
ALTER POLICY "actors_read_directory" ON "public"."actors"
  USING ("deleted_at" IS NULL);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."actor_is_current_subject"(p_actor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."actors" AS a
    WHERE a."actor_id" = p_actor_id
      AND a."auth_subject" = (SELECT auth.uid())::text
      AND a."deleted_at" IS NULL
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."actor_is_current_subject"(text)
  FROM PUBLIC, "anon", "authenticated";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "private"."actor_is_current_subject"(text)
  TO "authenticated";
--> statement-breakpoint

DROP POLICY IF EXISTS "identities_own_subject" ON "public"."identities";
--> statement-breakpoint
CREATE POLICY "identities_own_subject" ON "public"."identities"
  FOR ALL TO "authenticated"
  USING ("provider" = 'supabase' AND "subject" = (SELECT auth.uid())::text)
  WITH CHECK (
    "provider" = 'supabase'
    AND "subject" = (SELECT auth.uid())::text
    AND "private"."actor_is_current_subject"("actor_id")
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "actors_insert_self" ON "public"."actors";
--> statement-breakpoint
CREATE POLICY "actors_insert_self" ON "public"."actors"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "auth_subject" = (SELECT auth.uid())::text
    AND "identity_strength" = 'self_declared'
    AND "actor_type" IN ('human', 'maintainer')
  );
--> statement-breakpoint

REVOKE ALL ON TABLE "public"."actors" FROM PUBLIC, "anon", "authenticated";
--> statement-breakpoint
GRANT SELECT (
  "actor_id", "actor_type", "identity_strength", "model_name", "runtime",
  "scope", "public_key_fingerprint", "owner_actor_id", "created_at",
  "updated_at", "deleted_at"
) ON TABLE "public"."actors" TO "anon", "authenticated";
--> statement-breakpoint
GRANT INSERT ("actor_id", "actor_type", "identity_strength", "auth_subject")
  ON TABLE "public"."actors" TO "authenticated";
--> statement-breakpoint

CREATE OR REPLACE VIEW "public"."actor_directory"
  WITH (security_invoker = true)
AS
SELECT
  "actor_id", "actor_type", "identity_strength", "model_name", "runtime",
  "scope", "public_key_fingerprint", "owner_actor_id", "created_at",
  "updated_at"
FROM "public"."actors"
WHERE "deleted_at" IS NULL;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."actor_directory" FROM PUBLIC, "anon", "authenticated";
--> statement-breakpoint
GRANT SELECT ON TABLE "public"."actor_directory" TO "anon", "authenticated", "service_role";
--> statement-breakpoint

ALTER VIEW "public"."current_project_revisions" SET (security_invoker = true);
--> statement-breakpoint
ALTER VIEW "public"."current_question_revisions" SET (security_invoker = true);
--> statement-breakpoint
ALTER VIEW "public"."current_task_revisions" SET (security_invoker = true);
--> statement-breakpoint
ALTER VIEW "public"."current_claim_revisions" SET (security_invoker = true);
--> statement-breakpoint

-- Pin the baseline trigger/query helpers to the trusted application schema so
-- the linter cannot report a mutable search_path. They are not SECURITY
-- DEFINER functions, so keeping public first preserves their existing SQL.
ALTER FUNCTION "public"."prevent_research_event_mutation"()
  SET search_path = public, pg_catalog;
--> statement-breakpoint
ALTER FUNCTION "public"."prevent_revision_mutation"()
  SET search_path = public, pg_catalog;
--> statement-breakpoint
ALTER FUNCTION "public"."claim_upstream_dependencies"(text, integer)
  SET search_path = public, pg_catalog;
--> statement-breakpoint
ALTER FUNCTION "public"."claim_downstream_dependents"(text, integer)
  SET search_path = public, pg_catalog;
--> statement-breakpoint
ALTER FUNCTION "public"."assert_claim_dependency_acyclic"()
  SET search_path = public, pg_catalog;
--> statement-breakpoint
ALTER FUNCTION "public"."enable_public_table_rls"()
  SET search_path = public, pg_catalog;
--> statement-breakpoint
ALTER FUNCTION "public"."prevent_published_frontier_mutation"()
  SET search_path = public, pg_catalog;
--> statement-breakpoint
ALTER FUNCTION "public"."prevent_published_frontier_member_mutation"()
  SET search_path = public, pg_catalog;
