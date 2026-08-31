CREATE TYPE "private"."research_graph_backfill_phase" AS ENUM('scanning', 'applying', 'blocked', 'complete');--> statement-breakpoint
ALTER TYPE "private"."legacy_relation_source" ADD VALUE 'challenge_revision' BEFORE 'challenge_impact';--> statement-breakpoint
CREATE TABLE "private"."research_graph_backfill_checkpoints" (
	"project_id" text PRIMARY KEY NOT NULL,
	"schema_version" text NOT NULL,
	"phase" "private"."research_graph_backfill_phase" DEFAULT 'scanning' NOT NULL,
	"cursors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_sources" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"source_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_checksums" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plan_checksum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "research_graph_backfill_checkpoints_schema" CHECK ("private"."research_graph_backfill_checkpoints"."schema_version" = 'evimesh.research-graph-backfill-checkpoint.v1'),
	CONSTRAINT "research_graph_backfill_checkpoints_plan_checksum" CHECK ("private"."research_graph_backfill_checkpoints"."plan_checksum" IS NULL OR "private"."research_graph_backfill_checkpoints"."plan_checksum" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "research_graph_backfill_checkpoints_completion" CHECK (("private"."research_graph_backfill_checkpoints"."phase" = 'complete' AND "private"."research_graph_backfill_checkpoints"."completed_at" IS NOT NULL AND "private"."research_graph_backfill_checkpoints"."plan_checksum" IS NOT NULL) OR ("private"."research_graph_backfill_checkpoints"."phase" <> 'complete' AND "private"."research_graph_backfill_checkpoints"."completed_at" IS NULL)),
	CONSTRAINT "research_graph_backfill_checkpoints_timestamps" CHECK ("private"."research_graph_backfill_checkpoints"."updated_at" >= "private"."research_graph_backfill_checkpoints"."created_at")
);
--> statement-breakpoint
CREATE TABLE "private"."research_graph_backfill_staging" (
	"project_id" text NOT NULL,
	"source" "private"."legacy_relation_source" NOT NULL,
	"source_key" text NOT NULL,
	"source_payload" jsonb NOT NULL,
	"source_checksum" text NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_graph_backfill_staging_pkey" PRIMARY KEY("project_id","source","source_key"),
	CONSTRAINT "research_graph_backfill_staging_key_nonempty" CHECK ("private"."research_graph_backfill_staging"."source_key" <> ''),
	CONSTRAINT "research_graph_backfill_staging_checksum_format" CHECK ("private"."research_graph_backfill_staging"."source_checksum" ~ '^sha256:[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "private"."research_graph_backfill_checkpoints" ADD CONSTRAINT "research_graph_backfill_checkpoints_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_graph_backfill_staging" ADD CONSTRAINT "research_graph_backfill_staging_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_graph_backfill_checkpoints_phase_idx" ON "private"."research_graph_backfill_checkpoints" USING btree ("phase","updated_at");--> statement-breakpoint
CREATE INDEX "research_graph_backfill_staging_source_idx" ON "private"."research_graph_backfill_staging" USING btree ("project_id","source","source_key");
--> statement-breakpoint
-- Backfill operational state remains private. Browser roles never receive
-- privileges on these tables; only the service-side repository can stage raw
-- rows and advance a checkpoint.
CREATE OR REPLACE FUNCTION private.protect_research_graph_backfill_checkpoint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, private, public
AS $function$
BEGIN
  IF OLD.project_id IS DISTINCT FROM NEW.project_id
    OR OLD.schema_version IS DISTINCT FROM NEW.schema_version
    OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'research graph backfill checkpoint identity is immutable'
      USING ERRCODE = '23514';
  END IF;
  IF OLD.phase = 'complete' THEN
    RAISE EXCEPTION 'completed research graph backfill checkpoint is immutable'
      USING ERRCODE = '23514';
  END IF;
  IF OLD.plan_checksum IS NOT NULL
    AND OLD.plan_checksum IS DISTINCT FROM NEW.plan_checksum THEN
    RAISE EXCEPTION 'research graph backfill plan checksum is immutable once assigned'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'research graph backfill checkpoint time cannot move backwards'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;
--> statement-breakpoint
CREATE TRIGGER research_graph_backfill_checkpoints_protect_trigger
BEFORE UPDATE ON private.research_graph_backfill_checkpoints
FOR EACH ROW EXECUTE FUNCTION private.protect_research_graph_backfill_checkpoint();
--> statement-breakpoint
CREATE TRIGGER research_graph_backfill_checkpoints_no_delete_trigger
BEFORE DELETE ON private.research_graph_backfill_checkpoints
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER research_graph_backfill_staging_append_only_trigger
BEFORE UPDATE OR DELETE ON private.research_graph_backfill_staging
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
ALTER TABLE private.research_graph_backfill_checkpoints ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE private.research_graph_backfill_staging ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE private.research_graph_backfill_checkpoints FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE private.research_graph_backfill_staging FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.protect_research_graph_backfill_checkpoint() FROM PUBLIC;
--> statement-breakpoint
DO $security$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE private.research_graph_backfill_checkpoints FROM anon;
    REVOKE ALL ON TABLE private.research_graph_backfill_staging FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE private.research_graph_backfill_checkpoints FROM authenticated;
    REVOKE ALL ON TABLE private.research_graph_backfill_staging FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT ON TABLE private.research_graph_backfill_checkpoints TO service_role;
    GRANT UPDATE (phase, cursors, completed_sources, source_counts, source_checksums, plan_checksum, updated_at, completed_at)
      ON TABLE private.research_graph_backfill_checkpoints TO service_role;
    GRANT SELECT, INSERT ON TABLE private.research_graph_backfill_staging TO service_role;
    GRANT EXECUTE ON FUNCTION private.protect_research_graph_backfill_checkpoint() TO service_role;
    CREATE POLICY rg_backfill_checkpoints_read_service
      ON private.research_graph_backfill_checkpoints
      FOR SELECT TO service_role USING (true);
    CREATE POLICY rg_backfill_checkpoints_insert_service
      ON private.research_graph_backfill_checkpoints
      FOR INSERT TO service_role WITH CHECK (true);
    CREATE POLICY rg_backfill_checkpoints_update_service
      ON private.research_graph_backfill_checkpoints
      FOR UPDATE TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY rg_backfill_staging_read_service
      ON private.research_graph_backfill_staging
      FOR SELECT TO service_role USING (true);
    CREATE POLICY rg_backfill_staging_insert_service
      ON private.research_graph_backfill_staging
      FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END
$security$;
--> statement-breakpoint
-- Server-only immutable compatibility surface. The API Worker may reconstruct
-- an old Claim/Evidence/Challenge response from the exact source payload, but
-- browser roles cannot enumerate archived or permission-trimmed relations.
CREATE OR REPLACE VIEW public.research_graph_legacy_relations
WITH (security_invoker = true)
AS
SELECT
  mapping_id,
  project_id,
  source,
  source_key,
  source_payload,
  mapping_kind,
  status,
  mapped_node_kind,
  mapped_node_id,
  mapped_node_revision,
  mapped_edge_id
FROM private.legacy_relation_records;
--> statement-breakpoint
REVOKE ALL ON TABLE public.research_graph_legacy_relations FROM PUBLIC;
--> statement-breakpoint
DO $compatibility_security$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.research_graph_legacy_relations FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.research_graph_legacy_relations FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT ON TABLE public.research_graph_legacy_relations TO service_role;
  END IF;
END
$compatibility_security$;
