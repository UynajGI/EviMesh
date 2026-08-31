ALTER TYPE "private"."legacy_relation_source" ADD VALUE 'research_node' BEFORE 'claim_relation';--> statement-breakpoint
ALTER TYPE "private"."migration_finding_type" ADD VALUE 'unmapped_node';--> statement-breakpoint
ALTER TYPE "private"."research_edge_type" ADD VALUE 'materializes_evidence' AFTER 'packages_tool';--> statement-breakpoint
ALTER TYPE "private"."research_edge_type" ADD VALUE 'verifies_claim' AFTER 'produces_evidence';--> statement-breakpoint
ALTER TYPE "private"."research_edge_type" ADD VALUE 'verifies_run' AFTER 'verifies_claim';--> statement-breakpoint
ALTER TYPE "private"."research_edge_type" ADD VALUE 'uses_verification_contract' AFTER 'verifies_run';--> statement-breakpoint
ALTER TYPE "private"."research_edge_type" ADD VALUE 'reports_finding' AFTER 'uses_verification_contract';--> statement-breakpoint
ALTER TABLE "research_events" DROP CONSTRAINT "research_events_event_type_namespaced";
--> statement-breakpoint
ALTER TABLE "research_events" ADD CONSTRAINT "research_events_event_type_namespaced" CHECK ("research_events"."event_type" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.enforce_research_edge_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  endpoint_allowed boolean := false;
  target_event_id text;
  target_created_by text;
  author_role text;
  source_allowed boolean := false;
BEGIN
  endpoint_allowed := CASE NEW.edge_type
    WHEN 'extends_question' THEN NEW.source_kind = 'question' AND NEW.target_kind = 'question'
    WHEN 'answers' THEN NEW.source_kind = 'question' AND NEW.target_kind = 'answer'
    WHEN 'yields_claim' THEN NEW.source_kind = 'answer' AND NEW.target_kind = 'claim'
    WHEN 'rebuts' THEN NEW.source_kind IN ('answer', 'claim') AND NEW.target_kind = 'rebuttal'
    WHEN 'grounds_rebuttal' THEN NEW.source_kind IN ('claim', 'evidence', 'run', 'dataset', 'artifact') AND NEW.target_kind = 'rebuttal'
    WHEN 'evaluates' THEN NEW.source_kind = 'claim' AND NEW.target_kind = 'evaluation'
    WHEN 'evaluation_basis' THEN NEW.source_kind IN ('claim', 'evidence', 'run', 'dataset', 'artifact') AND NEW.target_kind = 'evaluation'
    WHEN 'challenges' THEN NEW.source_kind = 'claim' AND NEW.target_kind = 'challenge'
    WHEN 'uses_dataset' THEN
      (NEW.source_kind = 'dataset' AND NEW.target_kind IN ('question', 'task', 'run', 'claim'))
      OR (NEW.source_kind = 'claim' AND NEW.target_kind = 'claim')
    WHEN 'uses_tool' THEN
      (NEW.source_kind = 'tool' AND NEW.target_kind IN ('question', 'task', 'run', 'claim'))
      OR (NEW.source_kind = 'claim' AND NEW.target_kind = 'claim')
    WHEN 'uses_artifact' THEN NEW.source_kind = 'artifact' AND NEW.target_kind IN ('question', 'task', 'run')
    WHEN 'materializes_dataset' THEN NEW.source_kind = 'artifact' AND NEW.target_kind = 'dataset'
    WHEN 'packages_tool' THEN NEW.source_kind = 'artifact' AND NEW.target_kind = 'tool'
    WHEN 'materializes_evidence' THEN NEW.source_kind = 'artifact' AND NEW.target_kind = 'evidence'
    WHEN 'operationalizes' THEN NEW.source_kind IN ('question', 'answer', 'claim') AND NEW.target_kind = 'task'
    WHEN 'attempted_as' THEN NEW.source_kind = 'task' AND NEW.target_kind = 'attempt'
    WHEN 'produces_run' THEN NEW.source_kind = 'attempt' AND NEW.target_kind = 'run'
    WHEN 'context_for' THEN NEW.source_kind = 'context_bundle' AND NEW.target_kind = 'run'
    WHEN 'run_input' THEN NEW.source_kind IN ('dataset', 'tool', 'artifact', 'context_bundle') AND NEW.target_kind = 'run'
    WHEN 'produces_artifact' THEN NEW.source_kind = 'run' AND NEW.target_kind = 'artifact'
    WHEN 'produces_evidence' THEN NEW.source_kind = 'run' AND NEW.target_kind = 'evidence'
    WHEN 'verifies_claim' THEN NEW.source_kind = 'claim' AND NEW.target_kind = 'verification_receipt'
    WHEN 'verifies_run' THEN NEW.source_kind = 'run' AND NEW.target_kind = 'verification_receipt'
    WHEN 'uses_verification_contract' THEN NEW.source_kind = 'verification_contract' AND NEW.target_kind = 'verification_receipt'
    WHEN 'reports_finding' THEN NEW.source_kind = 'verification_receipt' AND NEW.target_kind = 'verification_finding'
    WHEN 'supersedes' THEN NEW.source_kind = NEW.target_kind
    WHEN 'requires' THEN
      (NEW.source_kind = 'claim' AND NEW.target_kind = 'claim')
      OR (NEW.source_kind = 'task' AND NEW.target_kind = 'task')
      OR (NEW.source_kind = 'research_contract' AND NEW.target_kind = 'question')
    WHEN 'derived_from' THEN
      (NEW.source_kind IN ('question', 'answer', 'claim', 'dataset', 'tool', 'artifact', 'evidence', 'run', 'context_bundle') AND NEW.target_kind = 'answer')
      OR (NEW.source_kind = 'claim' AND NEW.target_kind = 'claim')
    WHEN 'extends' THEN NEW.source_kind = 'claim' AND NEW.target_kind = 'claim'
    WHEN 'implements' THEN NEW.source_kind = 'claim' AND NEW.target_kind = 'claim'
    ELSE false
  END;

  IF NOT endpoint_allowed THEN
    RAISE EXCEPTION 'research edge % does not allow % -> %', NEW.edge_type, NEW.source_kind, NEW.target_kind
      USING ERRCODE = '23514';
  END IF;

  SELECT revision.source_event_id, revision.created_by
    INTO target_event_id, target_created_by
    FROM private.research_node_revisions AS revision
   WHERE revision.node_kind = NEW.target_kind
     AND revision.node_id = NEW.target_id
     AND revision.revision = NEW.target_revision;

  IF target_event_id IS DISTINCT FROM NEW.provenance_event_id THEN
    RAISE EXCEPTION 'research edge must be committed by the target revision source event'
      USING ERRCODE = '23514';
  END IF;

  IF target_created_by IS DISTINCT FROM NEW.created_by THEN
    RAISE EXCEPTION 'research edge author must match the immutable target revision author'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.role
    INTO author_role
    FROM private.research_node_revisions AS revision
    JOIN private.research_nodes AS node
      ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
    JOIN public.project_members AS membership
      ON membership.project_id = node.project_id
     AND membership.actor_id = NEW.created_by
     AND membership.deleted_at IS NULL
   WHERE revision.node_kind = NEW.target_kind
     AND revision.node_id = NEW.target_id
     AND revision.revision = NEW.target_revision;

  IF author_role IS NULL OR author_role NOT IN ('owner', 'maintainer', 'contributor') THEN
    RAISE EXCEPTION 'research edge author requires owner, maintainer, or contributor project role'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    (project.state = 'active' AND project.deleted_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.project_members AS source_membership
      WHERE source_membership.project_id = node.project_id
        AND source_membership.actor_id = NEW.created_by
        AND source_membership.deleted_at IS NULL
    )
    INTO source_allowed
    FROM private.research_node_revisions AS revision
    JOIN private.research_nodes AS node
      ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
    JOIN public.projects AS project ON project.project_id = node.project_id
   WHERE revision.node_kind = NEW.source_kind
     AND revision.node_id = NEW.source_id
     AND revision.revision = NEW.source_revision;

  IF source_allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'research edge author cannot reference a hidden source project'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TABLE "private"."legacy_node_records" (
	"mapping_id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source_kind" "private"."research_node_kind" NOT NULL,
	"source_id" text NOT NULL,
	"source_revision" integer NOT NULL,
	"source_payload" jsonb NOT NULL,
	"source_checksum" text NOT NULL,
	"status" "private"."legacy_mapping_status" NOT NULL,
	"mapped_node_kind" "private"."research_node_kind",
	"mapped_node_id" text,
	"mapped_node_revision" integer,
	"source_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_node_records_source_revision_positive" CHECK ("private"."legacy_node_records"."source_revision" > 0),
	CONSTRAINT "legacy_node_records_checksum_format" CHECK ("private"."legacy_node_records"."source_checksum" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "legacy_node_records_mapping_target" CHECK (("private"."legacy_node_records"."status" = 'mapped' AND "private"."legacy_node_records"."mapped_node_kind" IS NOT NULL AND "private"."legacy_node_records"."mapped_node_id" IS NOT NULL AND "private"."legacy_node_records"."mapped_node_revision" IS NOT NULL AND "private"."legacy_node_records"."source_event_id" IS NOT NULL) OR ("private"."legacy_node_records"."status" IN ('quarantined', 'archived') AND "private"."legacy_node_records"."mapped_node_kind" IS NULL AND "private"."legacy_node_records"."mapped_node_id" IS NULL AND "private"."legacy_node_records"."mapped_node_revision" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "private"."research_graph_migration_findings" ADD COLUMN "legacy_node_mapping_id" text;--> statement-breakpoint
ALTER TABLE "private"."legacy_node_records" ADD CONSTRAINT "legacy_node_records_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."legacy_node_records" ADD CONSTRAINT "legacy_node_records_source_event_id_research_events_event_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."legacy_node_records" ADD CONSTRAINT "legacy_node_records_mapped_node_fk" FOREIGN KEY ("mapped_node_kind","mapped_node_id","mapped_node_revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_node_records_source_unique" ON "private"."legacy_node_records" USING btree ("source_kind","source_id","source_revision");--> statement-breakpoint
CREATE INDEX "legacy_node_records_project_status_idx" ON "private"."legacy_node_records" USING btree ("project_id","status");--> statement-breakpoint
ALTER TABLE "private"."research_graph_migration_findings" ADD CONSTRAINT "research_graph_migration_findings_legacy_node_mapping_id_legacy_node_records_mapping_id_fk" FOREIGN KEY ("legacy_node_mapping_id") REFERENCES "private"."legacy_node_records"("mapping_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER legacy_node_records_append_only_trigger
BEFORE UPDATE OR DELETE ON private.legacy_node_records
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
ALTER TABLE private.legacy_node_records ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE private.legacy_node_records FROM PUBLIC;
--> statement-breakpoint
DO $node_backfill_security$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE private.legacy_node_records FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE private.legacy_node_records FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT ON TABLE private.legacy_node_records TO service_role;
    CREATE POLICY rg_legacy_node_records_read_service
      ON private.legacy_node_records FOR SELECT TO service_role USING (true);
    CREATE POLICY rg_legacy_node_records_insert_service
      ON private.legacy_node_records FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END
$node_backfill_security$;
--> statement-breakpoint
-- Service-only legacy/kernel dual-write helpers. They are intentionally kept
-- in the private schema and accept semantic values only; no helper accepts a
-- table name, column name, arbitrary SQL fragment, or generic node/edge plan.
CREATE OR REPLACE FUNCTION private.research_graph_dual_write_hash(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT 'sha256:' || encode(digest(convert_to(p_value::text, 'UTF8'), 'sha256'), 'hex')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.research_graph_events_semantically_equal(p_left jsonb,p_right jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT jsonb_typeof(p_left)='object' AND jsonb_typeof(p_right)='object'
    AND COALESCE(p_left->>'eventId',p_left->>'event_id') IS NOT DISTINCT FROM COALESCE(p_right->>'eventId',p_right->>'event_id')
    AND COALESCE(p_left->>'eventType',p_left->>'event_type') IS NOT DISTINCT FROM COALESCE(p_right->>'eventType',p_right->>'event_type')
    AND p_left->'payload' IS NOT DISTINCT FROM p_right->'payload'
    AND p_left->>'hash' IS NOT DISTINCT FROM p_right->>'hash'
    AND p_left->'signature' IS NOT DISTINCT FROM p_right->'signature'
    AND p_left->'parents' IS NOT DISTINCT FROM p_right->'parents'
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.persist_verified_research_event(
  p_event jsonb,
  p_expected_type text,
  p_actor_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_event_id text;
  v_event_type text;
  v_hash text;
  v_requested_at timestamptz;
  v_persisted record;
  v_parent text;
  v_parent_count integer;
  v_unique_parent_count integer;
BEGIN
  IF jsonb_typeof(p_event) <> 'object'
     OR jsonb_typeof(p_event->'payload') <> 'object'
     OR jsonb_typeof(p_event->'signature') <> 'object'
     OR jsonb_typeof(p_event->'parents') <> 'array' THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_INVALID] complete immutable event object required'
      USING ERRCODE = 'P0001';
  END IF;
  v_event_id := COALESCE(p_event->>'eventId', p_event->>'event_id');
  v_event_type := COALESCE(p_event->>'eventType', p_event->>'event_type');
  v_hash := p_event->>'hash';
  IF v_event_id IS NULL OR v_event_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR v_event_type IS DISTINCT FROM p_expected_type
     OR v_hash IS NULL OR v_hash !~* '^sha256:[0-9a-f]{64}$'
     OR p_event->'payload'->>'actor_id' IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_MISMATCH] event identity/type/actor does not match command'
      USING ERRCODE = 'P0001';
  END IF;
  v_requested_at := COALESCE(
    NULLIF(COALESCE(p_event->>'createdAt', p_event->>'created_at'), '')::timestamptz,
    NULLIF(COALESCE(p_event->>'occurredAt', p_event->>'occurred_at'), '')::timestamptz
  );
  INSERT INTO public.research_events (event_id,event_type,payload,hash,signature,parents,created_at)
  VALUES (v_event_id,v_event_type,p_event->'payload',v_hash,p_event->'signature',p_event->'parents',COALESCE(v_requested_at,transaction_timestamp()))
  ON CONFLICT (event_id) DO NOTHING;
  SELECT event_type,payload,hash,signature,parents,created_at INTO v_persisted
  FROM public.research_events WHERE event_id=v_event_id;
  IF NOT FOUND OR v_persisted.event_type IS DISTINCT FROM v_event_type
     OR v_persisted.payload IS DISTINCT FROM p_event->'payload'
     OR v_persisted.hash IS DISTINCT FROM v_hash
     OR v_persisted.signature IS DISTINCT FROM p_event->'signature'
     OR v_persisted.parents IS DISTINCT FROM p_event->'parents'
     OR (v_requested_at IS NOT NULL AND v_persisted.created_at IS DISTINCT FROM v_requested_at) THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT] event id already binds different immutable bytes'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*)::integer,count(DISTINCT value)::integer
    INTO v_parent_count,v_unique_parent_count
  FROM jsonb_array_elements_text(p_event->'parents') AS parent(value);
  IF v_parent_count IS DISTINCT FROM v_unique_parent_count THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_PARENT_INVALID] event parents must be unique'
      USING ERRCODE = 'P0001';
  END IF;
  FOR v_parent IN SELECT value FROM jsonb_array_elements_text(p_event->'parents') AS parent(value) LOOP
    IF v_parent=v_event_id OR v_parent !~* '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR NOT EXISTS (SELECT 1 FROM public.research_events WHERE event_id=v_parent) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_PARENT_INVALID] parent must be an existing distinct UUIDv7 event'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.research_event_parents (event_id,parent_event_id)
    VALUES (v_event_id,v_parent) ON CONFLICT DO NOTHING;
  END LOOP;
  IF (SELECT count(*) FROM public.research_event_parents WHERE event_id=v_event_id) IS DISTINCT FROM v_parent_count
     OR EXISTS (
       SELECT 1 FROM public.research_event_parents AS link
       WHERE link.event_id=v_event_id AND NOT (p_event->'parents' ? link.parent_event_id)
     ) THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT] immutable parent junction differs from event parents'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN v_event_id;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.insert_research_graph_dual_write_edge(
  p_edge_id text,
  p_edge_type private.research_edge_type,
  p_source_kind private.research_node_kind,
  p_source_id text,
  p_source_revision integer,
  p_target_kind private.research_node_kind,
  p_target_id text,
  p_target_revision integer,
  p_event_id text,
  p_actor_id text,
  p_created_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_source record;
  v_target record;
  v_existing record;
BEGIN
  SELECT revision.commit_rank,revision.batch_rank,node.project_id INTO v_source
  FROM private.research_node_revisions AS revision
  JOIN private.research_nodes AS node ON node.node_kind=revision.node_kind AND node.node_id=revision.node_id
  WHERE revision.node_kind=p_source_kind AND revision.node_id=p_source_id AND revision.revision=p_source_revision;
  SELECT revision.commit_rank,revision.batch_rank,node.project_id INTO v_target
  FROM private.research_node_revisions AS revision
  JOIN private.research_nodes AS node ON node.node_kind=revision.node_kind AND node.node_id=revision.node_id
  WHERE revision.node_kind=p_target_kind AND revision.node_id=p_target_id AND revision.revision=p_target_revision;
  IF v_source.commit_rank IS NULL OR v_target.commit_rank IS NULL OR v_source.project_id IS DISTINCT FROM v_target.project_id THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_DANGLING] edge endpoints must be exact revisions in one project'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO private.research_edges (
    edge_id,edge_type,source_kind,source_id,source_revision,source_commit_rank,source_batch_rank,
    target_kind,target_id,target_revision,target_commit_rank,target_batch_rank,provenance_event_id,created_by,created_at
  ) VALUES (
    p_edge_id,p_edge_type,p_source_kind,p_source_id,p_source_revision,v_source.commit_rank,v_source.batch_rank,
    p_target_kind,p_target_id,p_target_revision,v_target.commit_rank,v_target.batch_rank,p_event_id,p_actor_id,p_created_at
  ) ON CONFLICT DO NOTHING;
  SELECT edge_id,provenance_event_id,created_by INTO v_existing
  FROM private.research_edges
  WHERE edge_type=p_edge_type AND source_kind=p_source_kind AND source_id=p_source_id AND source_revision=p_source_revision
    AND target_kind=p_target_kind AND target_id=p_target_id AND target_revision=p_target_revision;
  IF NOT FOUND OR v_existing.edge_id IS DISTINCT FROM p_edge_id
     OR v_existing.provenance_event_id IS DISTINCT FROM p_event_id
     OR v_existing.created_by IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EDGE_CONFLICT] exact endpoint relation already has different provenance'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN p_edge_id;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.insert_research_graph_dual_write_node_crosswalk(
  p_project_id text,
  p_kind private.research_node_kind,
  p_node_id text,
  p_revision integer,
  p_source_payload jsonb,
  p_event_id text,
  p_event_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_mapping_id text := 'dual_node:'||p_kind::text||':'||p_node_id||'@'||p_revision::text;
  v_existing record;
BEGIN
  INSERT INTO private.legacy_node_records (
    mapping_id,project_id,source_kind,source_id,source_revision,source_payload,source_checksum,status,
    mapped_node_kind,mapped_node_id,mapped_node_revision,source_event_id
  ) VALUES (
    v_mapping_id,p_project_id,p_kind,p_node_id,p_revision,p_source_payload,p_event_hash,'mapped',
    p_kind,p_node_id,p_revision,p_event_id
  ) ON CONFLICT DO NOTHING;
  SELECT mapping_id,project_id,source_checksum,status,mapped_node_kind,mapped_node_id,mapped_node_revision,source_event_id
    INTO v_existing
  FROM private.legacy_node_records
  WHERE source_kind=p_kind AND source_id=p_node_id AND source_revision=p_revision;
  IF NOT FOUND OR v_existing.mapping_id IS DISTINCT FROM v_mapping_id
     OR v_existing.project_id IS DISTINCT FROM p_project_id
     OR v_existing.source_checksum IS DISTINCT FROM p_event_hash
     OR v_existing.status IS DISTINCT FROM 'mapped'::private.legacy_mapping_status
     OR v_existing.mapped_node_kind IS DISTINCT FROM p_kind
     OR v_existing.mapped_node_id IS DISTINCT FROM p_node_id
     OR v_existing.mapped_node_revision IS DISTINCT FROM p_revision
     OR v_existing.source_event_id IS DISTINCT FROM p_event_id THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_CROSSWALK_CONFLICT] typed revision crosswalk differs'
      USING ERRCODE = 'P0001';
  END IF;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.insert_research_graph_dual_write_relation_crosswalk(
  p_mapping_id text,
  p_project_id text,
  p_source private.legacy_relation_source,
  p_source_key text,
  p_source_payload jsonb,
  p_source_checksum text,
  p_mapping_kind private.legacy_mapping_kind,
  p_mapped_node_kind private.research_node_kind DEFAULT NULL,
  p_mapped_node_id text DEFAULT NULL,
  p_mapped_node_revision integer DEFAULT NULL,
  p_mapped_edge_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing record;
BEGIN
  INSERT INTO private.legacy_relation_records (
    mapping_id,project_id,source,source_key,source_payload,source_checksum,mapping_kind,status,
    mapped_node_kind,mapped_node_id,mapped_node_revision,mapped_edge_id
  ) VALUES (
    p_mapping_id,p_project_id,p_source,p_source_key,p_source_payload,p_source_checksum,p_mapping_kind,'mapped',
    p_mapped_node_kind,p_mapped_node_id,p_mapped_node_revision,p_mapped_edge_id
  ) ON CONFLICT DO NOTHING;
  SELECT mapping_id,project_id,source_checksum,mapping_kind,status,mapped_node_kind,mapped_node_id,mapped_node_revision,mapped_edge_id
    INTO v_existing
  FROM private.legacy_relation_records WHERE source=p_source AND source_key=p_source_key;
  IF NOT FOUND OR v_existing.mapping_id IS DISTINCT FROM p_mapping_id
     OR v_existing.project_id IS DISTINCT FROM p_project_id
     OR v_existing.source_checksum IS DISTINCT FROM p_source_checksum
     OR v_existing.mapping_kind IS DISTINCT FROM p_mapping_kind
     OR v_existing.status IS DISTINCT FROM 'mapped'::private.legacy_mapping_status
     OR v_existing.mapped_node_kind IS DISTINCT FROM p_mapped_node_kind
     OR v_existing.mapped_node_id IS DISTINCT FROM p_mapped_node_id
     OR v_existing.mapped_node_revision IS DISTINCT FROM p_mapped_node_revision
     OR v_existing.mapped_edge_id IS DISTINCT FROM p_mapped_edge_id THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_CROSSWALK_CONFLICT] legacy relation crosswalk differs'
      USING ERRCODE = 'P0001';
  END IF;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.insert_research_graph_dual_write_node(
  p_kind private.research_node_kind,
  p_node_id text,
  p_revision integer,
  p_project_id text,
  p_actor_id text,
  p_event_id text,
  p_event_hash text,
  p_created_at timestamptz,
  p_label text,
  p_state private.research_document_state,
  p_href text,
  p_content jsonb,
  p_source_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_hash text := private.research_graph_dual_write_hash(p_content);
  v_existing record;
BEGIN
  IF p_revision < 1 OR p_node_id IS NULL OR p_node_id='' OR p_label IS NULL OR p_label='' OR p_href !~ '^/' THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_NODE_INVALID] exact revision identity and display metadata required'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_revision=1 THEN
    INSERT INTO private.research_nodes (node_id,node_kind,project_id,created_by,created_at)
    VALUES (p_node_id,p_kind,p_project_id,p_actor_id,p_created_at)
    ON CONFLICT DO NOTHING;
  END IF;
  SELECT node_kind,project_id,created_by INTO v_existing
  FROM private.research_nodes WHERE node_id=p_node_id;
  IF NOT FOUND OR v_existing.node_kind IS DISTINCT FROM p_kind
     OR v_existing.project_id IS DISTINCT FROM p_project_id
     OR (p_revision=1 AND v_existing.created_by IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_NODE_CONFLICT] stable node identity differs'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_revision>1 AND NOT EXISTS (
    SELECT 1 FROM private.research_node_revisions
    WHERE node_kind=p_kind AND node_id=p_node_id AND revision=p_revision-1
  ) THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_REVISION_GAP] exact previous revision is missing'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO private.research_node_revisions (
    node_kind,node_id,revision,supersedes_revision,batch_rank,canonical_content_hash,label,state,
    canonical_href,source_event_id,created_by,created_at
  ) VALUES (
    p_kind,p_node_id,p_revision,CASE WHEN p_revision=1 THEN NULL ELSE p_revision-1 END,1,v_hash,p_label,p_state,
    p_href,p_event_id,p_actor_id,p_created_at
  ) ON CONFLICT DO NOTHING;
  SELECT supersedes_revision,canonical_content_hash,label,state,canonical_href,source_event_id,created_by,created_at
    INTO v_existing
  FROM private.research_node_revisions
  WHERE node_kind=p_kind AND node_id=p_node_id AND revision=p_revision;
  IF NOT FOUND OR v_existing.supersedes_revision IS DISTINCT FROM (CASE WHEN p_revision=1 THEN NULL ELSE p_revision-1 END)
     OR v_existing.canonical_content_hash IS DISTINCT FROM v_hash
     OR v_existing.label IS DISTINCT FROM p_label OR v_existing.state IS DISTINCT FROM p_state
     OR v_existing.canonical_href IS DISTINCT FROM p_href
     OR v_existing.source_event_id IS DISTINCT FROM p_event_id
     OR v_existing.created_by IS DISTINCT FROM p_actor_id
     OR v_existing.created_at IS DISTINCT FROM p_created_at THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_REVISION_CONFLICT] immutable node revision differs'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_revision>1 THEN
    PERFORM private.insert_research_graph_dual_write_edge(
      'dual_edge:supersedes:'||p_kind::text||':'||p_node_id||'@'||p_revision::text,
      'supersedes',p_kind,p_node_id,p_revision-1,p_kind,p_node_id,p_revision,p_event_id,p_actor_id,p_created_at
    );
  END IF;
  IF p_source_payload IS NOT NULL THEN
    PERFORM private.insert_research_graph_dual_write_node_crosswalk(
      p_project_id,p_kind,p_node_id,p_revision,p_source_payload,p_event_id,p_event_hash
    );
  END IF;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.insert_research_graph_dual_write_evaluation(
  p_project_id text,
  p_evidence_id text,
  p_claim_id text,
  p_claim_revision integer,
  p_stance private.evaluation_stance,
  p_event jsonb,
  p_actor_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_event_id text := COALESCE(p_event->>'eventId',p_event->>'event_id');
  v_event_hash text := p_event->>'hash';
  v_created_at timestamptz;
  v_evaluation_id text := 'evaluation_dual_'||COALESCE(p_event->>'eventId',p_event->>'event_id');
  v_content jsonb;
  v_subject_edge text := 'dual_edge:evaluates:'||COALESCE(p_event->>'eventId',p_event->>'event_id');
  v_basis_edge text := 'dual_edge:evaluation_basis:'||COALESCE(p_event->>'eventId',p_event->>'event_id');
BEGIN
  SELECT created_at INTO v_created_at FROM public.research_events WHERE event_id=v_event_id;
  IF NOT EXISTS (
    SELECT 1 FROM private.research_nodes AS node
    JOIN private.research_node_revisions AS revision ON revision.node_kind=node.node_kind AND revision.node_id=node.node_id
    WHERE node.node_kind='claim' AND node.node_id=p_claim_id AND revision.revision=p_claim_revision AND node.project_id=p_project_id
  ) OR NOT EXISTS (
    SELECT 1 FROM private.research_nodes AS node
    JOIN private.research_node_revisions AS revision ON revision.node_kind=node.node_kind AND revision.node_id=node.node_id
    WHERE node.node_kind='evidence' AND node.node_id=p_evidence_id AND revision.revision=1 AND node.project_id=p_project_id
  ) THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_DANGLING] Evaluation subject and basis revisions must already exist'
      USING ERRCODE = 'P0001';
  END IF;
  v_content := jsonb_build_object(
    'subject',jsonb_build_object('kind','claim','id',p_claim_id,'revision',p_claim_revision),
    'bases',jsonb_build_array(jsonb_build_object('kind','evidence','id',p_evidence_id,'revision',1)),
    'stance',p_stance::text,
    'rationale','Legacy Evidence relation mirrored transactionally.',
    'method','legacy-dual-write'
  );
  PERFORM private.insert_research_graph_dual_write_node(
    'evaluation',v_evaluation_id,1,p_project_id,p_actor_id,v_event_id,v_event_hash,v_created_at,
    'Evaluation · '||p_stance::text,'published','/evaluations/'||v_evaluation_id,v_content,NULL
  );
  INSERT INTO private.evaluation_revisions (
    evaluation_id,revision,node_kind,subject_kind,subject_id,subject_revision,stance,rationale,method
  ) VALUES (
    v_evaluation_id,1,'evaluation','claim',p_claim_id,p_claim_revision,p_stance,
    'Legacy Evidence relation mirrored transactionally.','legacy-dual-write'
  ) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM private.evaluation_revisions WHERE evaluation_id=v_evaluation_id AND revision=1
      AND subject_kind='claim' AND subject_id=p_claim_id AND subject_revision=p_claim_revision AND stance=p_stance
  ) THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_MOTIF_CONFLICT] Evaluation subtype differs'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO private.evaluation_bases (evaluation_id,evaluation_revision,basis_kind,basis_id,basis_revision)
  VALUES (v_evaluation_id,1,'evidence',p_evidence_id,1) ON CONFLICT DO NOTHING;
  PERFORM private.insert_research_graph_dual_write_edge(
    v_subject_edge,'evaluates','claim',p_claim_id,p_claim_revision,'evaluation',v_evaluation_id,1,
    v_event_id,p_actor_id,v_created_at
  );
  PERFORM private.insert_research_graph_dual_write_edge(
    v_basis_edge,'evaluation_basis','evidence',p_evidence_id,1,'evaluation',v_evaluation_id,1,
    v_event_id,p_actor_id,v_created_at
  );
  PERFORM private.insert_research_graph_dual_write_relation_crosswalk(
    'dual_relation:'||v_event_id,p_project_id,'evidence_claim_link',
    p_evidence_id||'|'||p_stance::text||'|'||p_claim_id||'@'||p_claim_revision::text,
    jsonb_build_object('event',p_event,'evidenceId',p_evidence_id,'claimId',p_claim_id,'claimRevision',p_claim_revision,'relationType',p_stance::text),
    v_event_hash,'evaluation','evaluation',v_evaluation_id,1,NULL
  );
  RETURN v_evaluation_id;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.assert_research_graph_dual_write_role(
  p_project_id text,
  p_actor_id text,
  p_claimed_role text,
  p_required_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_rank integer;
  v_required_rank integer;
BEGIN
  SELECT role INTO v_role FROM public.project_members
  WHERE project_id=p_project_id AND actor_id=p_actor_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_role IS DISTINCT FROM p_claimed_role THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_ROLE_MISMATCH] current project membership differs from verified command role'
      USING ERRCODE = 'P0001';
  END IF;
  v_rank := CASE v_role WHEN 'owner' THEN 4 WHEN 'maintainer' THEN 3 WHEN 'contributor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
  v_required_rank := CASE p_required_role WHEN 'owner' THEN 4 WHEN 'maintainer' THEN 3 WHEN 'contributor' THEN 2 WHEN 'viewer' THEN 1 ELSE 99 END;
  IF v_rank < v_required_rank THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_FORBIDDEN] project role is insufficient'
      USING ERRCODE = 'P0001';
  END IF;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.execute_research_graph_legacy_dual_write(
  p_mutation_kind text,
  p_command jsonb,
  p_verified_events jsonb,
  p_expected_legacy jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id text := p_command->>'actorId';
  v_actor_role text := p_command->>'actorRole';
  v_event jsonb;
  v_event_id text;
  v_event_hash text;
  v_event_type text;
  v_created_at timestamptz;
  v_project_id text;
  v_fallback_project_id text := p_command->>'projectId';
  v_question_id text;
  v_revision jsonb;
  v_claim jsonb;
  v_current_claim public.claim_revisions%ROWTYPE;
  v_current_challenge public.challenge_revisions%ROWTYPE;
  v_expected_revision integer;
  v_document_state private.research_document_state;
  v_item jsonb;
  v_link_event jsonb;
  v_index integer;
  v_count integer;
  v_evaluation_id text;
  v_is_replay boolean := false;
  v_kernel_nodes jsonb := '[]'::jsonb;
  v_kernel_edges jsonb := '[]'::jsonb;
BEGIN
  IF p_mutation_kind NOT IN (
    'claim.create','claim.revise','claim.transition','evidence.create','evidence.link',
    'verification_receipt.submit','challenge.create','challenge.transition'
  ) THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_KIND_INVALID] unsupported mutation kind'
      USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_command) <> 'object' OR jsonb_typeof(p_expected_legacy) <> 'object'
     OR jsonb_typeof(p_verified_events) <> 'array' OR jsonb_array_length(p_verified_events)=0
     OR v_actor_id IS NULL OR v_actor_id='' OR v_actor_role IS NULL OR v_actor_role='' THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_INPUT_INVALID] command, expected result, actor, and verified events are required'
      USING ERRCODE = 'P0001';
  END IF;
  v_event := p_verified_events->0;
  IF NOT private.research_graph_events_semantically_equal(p_expected_legacy->'event',v_event) THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] domain result event differs from verified event'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_mutation_kind LIKE 'claim.%' THEN
    IF jsonb_array_length(p_verified_events)<>1 THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_COUNT] Claim mutation requires exactly one event'
        USING ERRCODE = 'P0001';
    END IF;
    v_event_type := CASE p_mutation_kind
      WHEN 'claim.create' THEN 'claim.created'
      WHEN 'claim.revise' THEN 'claim.revised'
      ELSE 'claim.state_changed'
    END;
    v_revision := p_expected_legacy->'revision';
    v_claim := p_expected_legacy->'claim';
    v_expected_revision := NULLIF(v_revision->>'revision','')::integer;
    IF jsonb_typeof(v_revision)<>'object' OR jsonb_typeof(v_claim)<>'object'
       OR v_revision->>'claimId' IS DISTINCT FROM p_command->>'claimId'
       OR v_claim->>'claimId' IS DISTINCT FROM p_command->>'claimId'
       OR v_event->'payload'->>'claim_id' IS DISTINCT FROM p_command->>'claimId'
       OR NULLIF(v_event->'payload'->>'revision','')::integer IS DISTINCT FROM v_expected_revision
       OR v_event->'payload'#>'{projection,state,revision}' IS DISTINCT FROM v_revision
       OR v_event->'payload'#>'{projection,state,claim}' IS DISTINCT FROM jsonb_build_object(
         'claimId',v_claim->>'claimId','questionId',v_claim->'questionId','state',v_claim->>'state'
       ) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Claim command/result/signed projection differ'
        USING ERRCODE = 'P0001';
    END IF;
    IF p_mutation_kind='claim.create' THEN
      IF v_expected_revision<>1 OR (v_revision->'supersedes') IS DISTINCT FROM 'null'::jsonb
         OR v_revision->>'state'<>'hypothesis' OR v_claim->>'createdBy' IS DISTINCT FROM v_actor_id THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_REVISION_INVALID] Claim creation must be hypothesis revision 1'
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      SELECT * INTO v_current_claim FROM public.claim_revisions
      WHERE claim_id=p_command->>'claimId' ORDER BY revision DESC LIMIT 1 FOR UPDATE;
      v_is_replay := EXISTS (
        SELECT 1 FROM public.claim_revisions
        WHERE claim_id=p_command->>'claimId' AND revision=v_expected_revision
      );
      IF NOT v_is_replay AND (
        v_current_claim.claim_id IS NULL
        OR v_expected_revision IS DISTINCT FROM v_current_claim.revision+1
        OR NULLIF(v_revision->>'supersedes','')::integer IS DISTINCT FROM v_current_claim.revision
      ) THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_REVISION_RACE] current Claim revision changed after domain planning'
          USING ERRCODE = 'P0001';
      END IF;
      IF NOT v_is_replay AND p_mutation_kind='claim.revise'
         AND v_revision->>'state' IS DISTINCT FROM v_current_claim.state::text THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_REVISION_INVALID] Claim revise cannot change lifecycle state'
          USING ERRCODE = 'P0001';
      END IF;
      IF NOT v_is_replay AND p_mutation_kind='claim.transition' AND (
        v_event->'payload'->>'from_state' IS DISTINCT FROM v_current_claim.state::text
        OR v_event->'payload'->>'to_state' IS DISTINCT FROM v_revision->>'state'
        OR NOT (CASE v_current_claim.state::text
          WHEN 'hypothesis' THEN v_revision->>'state' IN ('candidate','contested','refuted','superseded','retracted','dependency_tainted')
          WHEN 'candidate' THEN v_revision->>'state' IN ('under_verification','contested','refuted','superseded','retracted','dependency_tainted')
          WHEN 'under_verification' THEN v_revision->>'state' IN ('provisionally_accepted','contested','refuted','superseded','retracted','dependency_tainted')
          WHEN 'provisionally_accepted' THEN v_revision->>'state' IN ('accepted','contested','refuted','superseded','retracted','dependency_tainted')
          WHEN 'accepted' THEN v_revision->>'state' IN ('contested','refuted','superseded','retracted','dependency_tainted')
          ELSE false END)
      ) THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_STATE_INVALID] invalid Claim transition'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
    v_event_id := private.persist_verified_research_event(v_event,v_event_type,v_actor_id);
    v_event_hash := v_event->>'hash';
    SELECT created_at INTO v_created_at FROM public.research_events WHERE event_id=v_event_id;
    v_question_id := v_revision->>'questionId';
    IF v_question_id IS NOT NULL THEN
      SELECT project_id INTO v_project_id FROM public.questions WHERE question_id=v_question_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_DANGLING] Claim Question does not exist'
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      v_project_id := v_fallback_project_id;
    END IF;
    IF v_project_id IS NULL AND p_mutation_kind<>'claim.create' THEN
      SELECT project_id INTO v_project_id FROM private.research_nodes
      WHERE node_kind='claim' AND node_id=p_command->>'claimId';
    END IF;
    IF v_project_id IS NULL OR (v_fallback_project_id IS NOT NULL AND v_fallback_project_id IS DISTINCT FROM v_project_id) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PROJECT_UNRESOLVED] Claim requires one exact project'
        USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.assert_research_graph_dual_write_role(v_project_id,v_actor_id,v_actor_role,'maintainer');
    IF p_mutation_kind='claim.create' THEN
      INSERT INTO public.claims (claim_id,question_id,state,created_by,created_at)
      VALUES (p_command->>'claimId',v_question_id,(v_revision->>'state')::public.claim_state,v_actor_id,v_created_at)
      ON CONFLICT DO NOTHING;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.claims WHERE claim_id=p_command->>'claimId'
        AND (p_mutation_kind<>'claim.create' OR (question_id IS NOT DISTINCT FROM v_question_id AND created_by=v_actor_id))
    ) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT] Claim stable row differs'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.claim_revisions (
      claim_id,revision,supersedes,state,statement,scope,assumptions,falsification,question_id,created_by,created_at
    ) VALUES (
      p_command->>'claimId',v_expected_revision,NULLIF(v_revision->>'supersedes','')::integer,
      (v_revision->>'state')::public.claim_state,v_revision->>'statement',v_revision->'scope',v_revision->'assumptions',
      v_revision->'falsification',v_question_id,v_actor_id,v_created_at
    ) ON CONFLICT DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.claim_revisions WHERE claim_id=p_command->>'claimId' AND revision=v_expected_revision
        AND supersedes IS NOT DISTINCT FROM NULLIF(v_revision->>'supersedes','')::integer
        AND state::text=v_revision->>'state' AND statement=v_revision->>'statement'
        AND scope=v_revision->'scope' AND assumptions=v_revision->'assumptions' AND falsification=v_revision->'falsification'
        AND question_id IS NOT DISTINCT FROM v_question_id AND created_by=v_actor_id AND created_at=v_created_at
    ) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT] Claim revision differs'
        USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.claims SET question_id=v_question_id,state=(v_revision->>'state')::public.claim_state,updated_at=v_created_at
    WHERE claim_id=p_command->>'claimId'
      AND NOT EXISTS (
        SELECT 1 FROM public.claim_revisions AS later
        WHERE later.claim_id=p_command->>'claimId' AND later.revision>v_expected_revision
      );
    v_document_state := CASE v_revision->>'state'
      WHEN 'retracted' THEN 'retracted'::private.research_document_state
      WHEN 'superseded' THEN 'superseded'::private.research_document_state
      ELSE 'published'::private.research_document_state END;
    PERFORM private.insert_research_graph_dual_write_node(
      'claim',p_command->>'claimId',v_expected_revision,v_project_id,v_actor_id,v_event_id,v_event_hash,v_created_at,
      v_revision->>'statement',v_document_state,'/claims/'||(p_command->>'claimId'),v_revision,
      jsonb_build_object('command',p_command,'legacy',p_expected_legacy,'event',v_event)
    );
    IF p_expected_legacy ? 'contribution' THEN
      v_item := p_expected_legacy->'contribution';
      IF COALESCE(v_item->>'eventId',v_event_id) IS DISTINCT FROM v_event_id
         OR v_item->>'role' IS DISTINCT FROM 'originator' THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Claim contribution differs'
          USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.contribution_statements (statement_id,event_id,actor_id,role,description,created_at)
      VALUES (v_item->>'statementId',v_event_id,v_item->>'actorId','originator',v_item->>'description',v_created_at)
      ON CONFLICT DO NOTHING;
      IF p_expected_legacy ? 'contributionEdge' THEN
        v_item := p_expected_legacy->'contributionEdge';
        INSERT INTO public.contribution_edges (statement_id,edge_type,object_type,object_id,object_revision)
        VALUES (v_item->>'statementId',(v_item->>'edgeType')::public.contribution_edge_type,v_item->>'objectType',v_item->>'objectId',(v_item->>'objectRevision')::integer)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
    v_kernel_nodes := jsonb_build_array(jsonb_build_object('kind','claim','id',p_command->>'claimId','revision',v_expected_revision));
    IF v_expected_revision>1 THEN
      v_kernel_edges := jsonb_build_array(jsonb_build_object('type','supersedes','sourceRevision',v_expected_revision-1,'targetRevision',v_expected_revision));
    END IF;
  ELSIF p_mutation_kind IN ('evidence.create','evidence.link') THEN
    IF p_mutation_kind='evidence.create' THEN
      v_item := p_expected_legacy->'evidence';
      IF jsonb_typeof(v_item)<>'object'
         OR v_item->>'evidenceId' IS DISTINCT FROM p_command->>'evidenceId'
         OR v_item->>'evidenceType' IS DISTINCT FROM p_command->>'evidenceType'
         OR v_item->>'artifactId' IS DISTINCT FROM p_command->>'artifactId'
         OR NULLIF(v_item->>'artifactRevision','')::integer IS DISTINCT FROM NULLIF(p_command->>'artifactRevision','')::integer
         OR v_item->>'createdBy' IS DISTINCT FROM v_actor_id
         OR v_event->'payload'->>'evidence_id' IS DISTINCT FROM p_command->>'evidenceId'
         OR NULLIF(v_event->'payload'->>'link_count','')::integer IS DISTINCT FROM jsonb_array_length(COALESCE(p_expected_legacy->'links','[]'::jsonb))
         OR jsonb_array_length(p_verified_events)<>1+jsonb_array_length(COALESCE(p_expected_legacy->'links','[]'::jsonb)) THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Evidence create result/events differ from command'
          USING ERRCODE = 'P0001';
      END IF;
      v_event_id := private.persist_verified_research_event(v_event,'evidence.created',v_actor_id);
      v_event_hash := v_event->>'hash';
      SELECT created_at INTO v_created_at FROM public.research_events WHERE event_id=v_event_id;
      v_project_id := NULL;
      FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_expected_legacy->'links','[]'::jsonb)) LOOP
        SELECT question.project_id INTO v_question_id
        FROM public.claim_revisions AS revision
        JOIN public.claims AS claim USING(claim_id)
        JOIN public.questions AS question ON question.question_id=claim.question_id
        WHERE revision.claim_id=v_item->>'claimId' AND revision.revision=(v_item->>'claimRevision')::integer;
        IF v_question_id IS NULL OR (v_project_id IS NOT NULL AND v_project_id IS DISTINCT FROM v_question_id) THEN
          RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PROJECT_UNRESOLVED] Evidence links must resolve to one project'
            USING ERRCODE = 'P0001';
        END IF;
        v_project_id := v_question_id;
      END LOOP;
      IF p_command->>'runId' IS NOT NULL THEN
        SELECT question.project_id INTO v_question_id
        FROM public.runs AS run JOIN public.tasks AS task USING(task_id)
        JOIN public.questions AS question ON question.question_id=task.question_id
        WHERE run.run_id=p_command->>'runId';
        IF v_question_id IS NULL OR (v_project_id IS NOT NULL AND v_project_id IS DISTINCT FROM v_question_id) THEN
          RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PROJECT_UNRESOLVED] Evidence Run differs from link project'
            USING ERRCODE = 'P0001';
        END IF;
        v_project_id := v_question_id;
      END IF;
      v_project_id := COALESCE(v_project_id,v_fallback_project_id);
      IF v_project_id IS NULL OR (v_fallback_project_id IS NOT NULL AND v_fallback_project_id IS DISTINCT FROM v_project_id) THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PROJECT_UNRESOLVED] Evidence requires one exact project'
          USING ERRCODE = 'P0001';
      END IF;
      PERFORM private.assert_research_graph_dual_write_role(v_project_id,v_actor_id,v_actor_role,'contributor');
      INSERT INTO public.evidence (evidence_id,evidence_type,artifact_id,artifact_revision,run_id,created_by,created_at)
      VALUES (
        p_command->>'evidenceId',(p_command->>'evidenceType')::public.evidence_type,p_command->>'artifactId',
        (p_command->>'artifactRevision')::integer,NULLIF(p_command->>'runId',''),v_actor_id,v_created_at
      ) ON CONFLICT DO NOTHING;
      IF NOT EXISTS (
        SELECT 1 FROM public.evidence WHERE evidence_id=p_command->>'evidenceId'
          AND evidence_type::text=p_command->>'evidenceType' AND artifact_id=p_command->>'artifactId'
          AND artifact_revision=(p_command->>'artifactRevision')::integer
          AND run_id IS NOT DISTINCT FROM NULLIF(p_command->>'runId','') AND created_by=v_actor_id
      ) THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT] Evidence row differs'
          USING ERRCODE = 'P0001';
      END IF;
      PERFORM private.insert_research_graph_dual_write_node(
        'evidence',p_command->>'evidenceId',1,v_project_id,v_actor_id,v_event_id,v_event_hash,v_created_at,
        (p_command->>'evidenceType')||' evidence','published','/evidence/'||(p_command->>'evidenceId'),
        p_expected_legacy->'evidence',jsonb_build_object('command',p_command,'legacy',p_expected_legacy,'event',v_event)
      );
      v_kernel_nodes := jsonb_build_array(jsonb_build_object('kind','evidence','id',p_command->>'evidenceId','revision',1));
      PERFORM private.insert_research_graph_dual_write_edge(
        'dual_edge:materializes_evidence:'||v_event_id,'materializes_evidence',
        'artifact',p_command->>'artifactId',(p_command->>'artifactRevision')::integer,
        'evidence',p_command->>'evidenceId',1,v_event_id,v_actor_id,v_created_at
      );
      v_kernel_edges := v_kernel_edges||jsonb_build_array(jsonb_build_object(
        'type','materializes_evidence','sourceKind','artifact','sourceId',p_command->>'artifactId',
        'sourceRevision',(p_command->>'artifactRevision')::integer,'targetKind','evidence','targetId',p_command->>'evidenceId','targetRevision',1
      ));
      IF p_command->>'runId' IS NOT NULL THEN
        PERFORM private.insert_research_graph_dual_write_edge(
          'dual_edge:produces_evidence:'||v_event_id,'produces_evidence','run',p_command->>'runId',1,
          'evidence',p_command->>'evidenceId',1,v_event_id,v_actor_id,v_created_at
        );
        v_kernel_edges := v_kernel_edges||jsonb_build_array(jsonb_build_object('type','produces_evidence','sourceId',p_command->>'runId','targetId',p_command->>'evidenceId'));
      END IF;
      v_index := 0;
      FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_expected_legacy->'links','[]'::jsonb)) LOOP
        v_link_event := p_verified_events->(v_index+1);
        IF NOT private.research_graph_events_semantically_equal(p_expected_legacy->'linkEvents'->v_index,v_link_event)
           OR v_item->>'evidenceId' IS DISTINCT FROM p_command->>'evidenceId'
           OR v_item->>'createdBy' IS DISTINCT FROM v_actor_id
           OR v_link_event->'payload'->>'evidence_id' IS DISTINCT FROM v_item->>'evidenceId'
           OR v_link_event->'payload'->>'claim_id' IS DISTINCT FROM v_item->>'claimId'
           OR (v_link_event->'payload'->>'claim_revision')::integer IS DISTINCT FROM (v_item->>'claimRevision')::integer
           OR v_link_event->'payload'->>'relation_type' IS DISTINCT FROM v_item->>'relationType' THEN
          RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Evidence link differs from signed event'
            USING ERRCODE = 'P0001';
        END IF;
        v_event_id := private.persist_verified_research_event(v_link_event,'evidence.claim_linked',v_actor_id);
        SELECT created_at INTO v_created_at FROM public.research_events WHERE event_id=v_event_id;
        INSERT INTO public.evidence_claim_links (evidence_id,claim_id,claim_revision,relation_type,created_by,created_at)
        VALUES (v_item->>'evidenceId',v_item->>'claimId',(v_item->>'claimRevision')::integer,(v_item->>'relationType')::public.evidence_claim_relation,v_actor_id,v_created_at)
        ON CONFLICT DO NOTHING;
        v_evaluation_id := private.insert_research_graph_dual_write_evaluation(
          v_project_id,v_item->>'evidenceId',v_item->>'claimId',(v_item->>'claimRevision')::integer,
          (v_item->>'relationType')::private.evaluation_stance,v_link_event,v_actor_id
        );
        v_kernel_nodes := v_kernel_nodes||jsonb_build_array(jsonb_build_object('kind','evaluation','id',v_evaluation_id,'revision',1));
        v_kernel_edges := v_kernel_edges||jsonb_build_array(
          jsonb_build_object('type','evaluates','targetId',v_evaluation_id),
          jsonb_build_object('type','evaluation_basis','targetId',v_evaluation_id)
        );
        v_index := v_index+1;
      END LOOP;
    ELSE
      IF jsonb_array_length(p_verified_events)<>1 THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_COUNT] Evidence link requires exactly one event'
          USING ERRCODE = 'P0001';
      END IF;
      v_item := p_expected_legacy->'link';
      IF jsonb_typeof(v_item)<>'object'
         OR v_item->>'evidenceId' IS DISTINCT FROM p_command->>'evidenceId'
         OR v_item->>'claimId' IS DISTINCT FROM p_command->>'claimId'
         OR (v_item->>'claimRevision')::integer IS DISTINCT FROM (p_command->>'claimRevision')::integer
         OR v_item->>'relationType' IS DISTINCT FROM p_command->>'relationType'
         OR v_item->>'createdBy' IS DISTINCT FROM v_actor_id
         OR v_event->'payload'->>'evidence_id' IS DISTINCT FROM v_item->>'evidenceId'
         OR v_event->'payload'->>'claim_id' IS DISTINCT FROM v_item->>'claimId'
         OR (v_event->'payload'->>'claim_revision')::integer IS DISTINCT FROM (v_item->>'claimRevision')::integer
         OR v_event->'payload'->>'relation_type' IS DISTINCT FROM v_item->>'relationType' THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Evidence link command/result/event differ'
          USING ERRCODE = 'P0001';
      END IF;
      SELECT question.project_id INTO v_project_id
      FROM public.claim_revisions AS revision JOIN public.claims AS claim USING(claim_id)
      JOIN public.questions AS question ON question.question_id=claim.question_id
      WHERE revision.claim_id=v_item->>'claimId' AND revision.revision=(v_item->>'claimRevision')::integer;
      IF v_project_id IS NULL OR (v_fallback_project_id IS NOT NULL AND v_fallback_project_id IS DISTINCT FROM v_project_id) THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PROJECT_UNRESOLVED] Evidence link Claim requires one exact project'
          USING ERRCODE = 'P0001';
      END IF;
      PERFORM private.assert_research_graph_dual_write_role(v_project_id,v_actor_id,v_actor_role,'contributor');
      v_event_id := private.persist_verified_research_event(v_event,'evidence.claim_linked',v_actor_id);
      SELECT created_at INTO v_created_at FROM public.research_events WHERE event_id=v_event_id;
      INSERT INTO public.evidence_claim_links (evidence_id,claim_id,claim_revision,relation_type,created_by,created_at)
      VALUES (v_item->>'evidenceId',v_item->>'claimId',(v_item->>'claimRevision')::integer,(v_item->>'relationType')::public.evidence_claim_relation,v_actor_id,v_created_at)
      ON CONFLICT DO NOTHING;
      v_evaluation_id := private.insert_research_graph_dual_write_evaluation(
        v_project_id,v_item->>'evidenceId',v_item->>'claimId',(v_item->>'claimRevision')::integer,
        (v_item->>'relationType')::private.evaluation_stance,v_event,v_actor_id
      );
      v_kernel_nodes := jsonb_build_array(jsonb_build_object('kind','evaluation','id',v_evaluation_id,'revision',1));
      v_kernel_edges := jsonb_build_array(
        jsonb_build_object('type','evaluates','targetId',v_evaluation_id),
        jsonb_build_object('type','evaluation_basis','targetId',v_evaluation_id)
      );
    END IF;
  ELSIF p_mutation_kind='verification_receipt.submit' THEN
    IF jsonb_array_length(p_verified_events)<>1 THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_COUNT] Verification submission requires exactly one event'
        USING ERRCODE = 'P0001';
    END IF;
    v_item := p_expected_legacy->'receipt';
    IF jsonb_typeof(v_item)<>'object'
       OR v_item->>'receiptId' IS DISTINCT FROM p_command->>'receiptId'
       OR v_item->>'runId' IS DISTINCT FROM p_command->>'runId'
       OR v_item->>'claimId' IS DISTINCT FROM p_command->>'claimId'
       OR (v_item->>'claimRevision')::integer IS DISTINCT FROM (p_command->>'claimRevision')::integer
       OR v_item->>'contractId' IS DISTINCT FROM p_command->>'contractId'
       OR (v_item->>'contractRevision')::integer IS DISTINCT FROM (p_command->>'contractRevision')::integer
       OR v_item->>'createdBy' IS DISTINCT FROM v_actor_id
       OR v_event->'payload'->>'receipt_id' IS DISTINCT FROM v_item->>'receiptId'
       OR v_event->'payload'->>'claim_id' IS DISTINCT FROM v_item->>'claimId'
       OR (v_event->'payload'->>'claim_revision')::integer IS DISTINCT FROM (v_item->>'claimRevision')::integer
       OR v_event->'payload'->>'contract_id' IS DISTINCT FROM v_item->>'contractId'
       OR (v_event->'payload'->>'contract_revision')::integer IS DISTINCT FROM (v_item->>'contractRevision')::integer
       OR v_event->'payload'->>'outcome' IS DISTINCT FROM v_item->>'outcome'
       OR (v_event->'payload'->>'finding_count')::integer IS DISTINCT FROM jsonb_array_length(COALESCE(p_expected_legacy->'findings','[]'::jsonb)) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Verification command/result/event differ'
        USING ERRCODE = 'P0001';
    END IF;
    SELECT question.project_id INTO v_project_id
    FROM public.claim_revisions AS revision JOIN public.claims AS claim USING(claim_id)
    JOIN public.questions AS question ON question.question_id=claim.question_id
    WHERE revision.claim_id=v_item->>'claimId' AND revision.revision=(v_item->>'claimRevision')::integer;
    IF v_project_id IS NULL OR (v_fallback_project_id IS NOT NULL AND v_fallback_project_id IS DISTINCT FROM v_project_id) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PROJECT_UNRESOLVED] Verification Claim requires one exact project'
        USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.assert_research_graph_dual_write_role(v_project_id,v_actor_id,v_actor_role,'contributor');
    v_event_id := private.persist_verified_research_event(v_event,'verification.submitted',v_actor_id);
    v_event_hash := v_event->>'hash';
    SELECT created_at INTO v_created_at FROM public.research_events WHERE event_id=v_event_id;
    INSERT INTO public.verification_receipts (
      receipt_id,run_id,duplicate_of_receipt_id,claim_id,claim_revision,contract_id,contract_revision,outcome,
      verification_types,context_mode,saw_expected_outputs,implementation_relation,data_relation,model_family,created_by,created_at
    ) VALUES (
      v_item->>'receiptId',v_item->>'runId',NULLIF(v_item->>'duplicateOfReceiptId',''),v_item->>'claimId',(v_item->>'claimRevision')::integer,
      v_item->>'contractId',(v_item->>'contractRevision')::integer,(v_item->>'outcome')::public.verification_outcome,
      v_item->'verificationTypes',v_item->>'contextMode',(v_item->>'sawExpectedOutputs')::boolean,v_item->>'implementationRelation',
      v_item->>'dataRelation',v_item->>'modelFamily',v_actor_id,v_created_at
    ) ON CONFLICT DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.verification_receipts WHERE receipt_id=v_item->>'receiptId'
        AND run_id IS NOT DISTINCT FROM v_item->>'runId' AND claim_id=v_item->>'claimId'
        AND claim_revision=(v_item->>'claimRevision')::integer AND contract_id=v_item->>'contractId'
        AND contract_revision=(v_item->>'contractRevision')::integer AND outcome::text=v_item->>'outcome'
        AND verification_types=v_item->'verificationTypes' AND context_mode=v_item->>'contextMode'
        AND saw_expected_outputs=(v_item->>'sawExpectedOutputs')::boolean
        AND implementation_relation=v_item->>'implementationRelation' AND data_relation=v_item->>'dataRelation'
        AND model_family=v_item->>'modelFamily' AND created_by=v_actor_id
    ) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT] Verification receipt differs'
        USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.insert_research_graph_dual_write_node(
      'verification_receipt',v_item->>'receiptId',1,v_project_id,v_actor_id,v_event_id,v_event_hash,v_created_at,
      'Verification receipt '||(v_item->>'receiptId'),'published','/verifications/'||(v_item->>'receiptId'),v_item,
      jsonb_build_object('command',p_command,'legacy',p_expected_legacy,'event',v_event)
    );
    v_kernel_nodes := jsonb_build_array(jsonb_build_object('kind','verification_receipt','id',v_item->>'receiptId','revision',1));
    PERFORM private.insert_research_graph_dual_write_edge(
      'dual_edge:verifies_claim:'||v_event_id,'verifies_claim','claim',v_item->>'claimId',(v_item->>'claimRevision')::integer,
      'verification_receipt',v_item->>'receiptId',1,v_event_id,v_actor_id,v_created_at
    );
    PERFORM private.insert_research_graph_dual_write_edge(
      'dual_edge:verifies_run:'||v_event_id,'verifies_run','run',v_item->>'runId',1,
      'verification_receipt',v_item->>'receiptId',1,v_event_id,v_actor_id,v_created_at
    );
    PERFORM private.insert_research_graph_dual_write_edge(
      'dual_edge:uses_verification_contract:'||v_event_id,'uses_verification_contract',
      'verification_contract',v_item->>'contractId',(v_item->>'contractRevision')::integer,
      'verification_receipt',v_item->>'receiptId',1,v_event_id,v_actor_id,v_created_at
    );
    v_kernel_edges := jsonb_build_array(
      jsonb_build_object('type','verifies_claim','sourceId',v_item->>'claimId','sourceRevision',(v_item->>'claimRevision')::integer,'targetId',v_item->>'receiptId'),
      jsonb_build_object('type','verifies_run','sourceId',v_item->>'runId','sourceRevision',1,'targetId',v_item->>'receiptId'),
      jsonb_build_object('type','uses_verification_contract','sourceId',v_item->>'contractId','sourceRevision',(v_item->>'contractRevision')::integer,'targetId',v_item->>'receiptId')
    );
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_expected_legacy->'findings','[]'::jsonb)) LOOP
      IF v_item->>'receiptId' IS DISTINCT FROM p_command->>'receiptId' THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Verification finding receipt differs'
          USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.verification_findings (finding_id,receipt_id,severity,code,details,created_at)
      VALUES (v_item->>'findingId',v_item->>'receiptId',(v_item->>'severity')::public.finding_severity,v_item->>'code',v_item->'details',v_created_at)
      ON CONFLICT DO NOTHING;
      IF NOT EXISTS (
        SELECT 1 FROM public.verification_findings WHERE finding_id=v_item->>'findingId' AND receipt_id=v_item->>'receiptId'
          AND severity::text=v_item->>'severity' AND code=v_item->>'code' AND details=v_item->'details'
      ) THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT] Verification finding differs'
          USING ERRCODE = 'P0001';
      END IF;
      PERFORM private.insert_research_graph_dual_write_node(
        'verification_finding',v_item->>'findingId',1,v_project_id,v_actor_id,v_event_id,v_event_hash,v_created_at,
        v_item->>'code','published','/verification-findings/'||(v_item->>'findingId'),v_item,
        jsonb_build_object('command',p_command,'legacyFinding',v_item,'event',v_event)
      );
      PERFORM private.insert_research_graph_dual_write_edge(
        'dual_edge:reports_finding:'||v_event_id||':'||(v_item->>'findingId'),'reports_finding',
        'verification_receipt',p_command->>'receiptId',1,'verification_finding',v_item->>'findingId',1,
        v_event_id,v_actor_id,v_created_at
      );
      v_kernel_nodes := v_kernel_nodes||jsonb_build_array(jsonb_build_object('kind','verification_finding','id',v_item->>'findingId','revision',1));
      v_kernel_edges := v_kernel_edges||jsonb_build_array(jsonb_build_object(
        'type','reports_finding','sourceId',p_command->>'receiptId','sourceRevision',1,'targetId',v_item->>'findingId','targetRevision',1
      ));
    END LOOP;
    v_item := p_expected_legacy->'contribution';
    IF jsonb_typeof(v_item)<>'object' OR v_item->>'statementId' IS DISTINCT FROM p_command->>'contributionStatementId'
       OR v_item->>'actorId' IS DISTINCT FROM v_actor_id OR v_item->>'role' IS DISTINCT FROM 'verifier' THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Verification contribution differs'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.contribution_statements (statement_id,event_id,actor_id,role,description,created_at)
    VALUES (v_item->>'statementId',v_event_id,v_actor_id,'verifier',v_item->>'description',v_created_at)
    ON CONFLICT DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.contribution_statements WHERE statement_id=v_item->>'statementId'
        AND event_id=v_event_id AND actor_id=v_actor_id AND role='verifier' AND description=v_item->>'description'
    ) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT] Verification contribution differs'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF jsonb_array_length(p_verified_events)<>1 THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_EVENT_COUNT] Challenge mutation requires exactly one event'
        USING ERRCODE = 'P0001';
    END IF;
    v_revision := p_expected_legacy->'revision';
    v_expected_revision := NULLIF(v_revision->>'revision','')::integer;
    IF jsonb_typeof(v_revision)<>'object'
       OR v_revision->>'challengeId' IS DISTINCT FROM p_command->>'challengeId'
       OR v_revision->>'createdBy' IS DISTINCT FROM v_actor_id
       OR v_event->'payload'->>'challenge_id' IS DISTINCT FROM p_command->>'challengeId'
       OR (v_event->'payload'->>'revision')::integer IS DISTINCT FROM v_expected_revision
       OR v_event->'payload'->>'target_claim_id' IS DISTINCT FROM v_revision->>'targetClaimId'
       OR (v_event->'payload'->>'target_claim_revision')::integer IS DISTINCT FROM (v_revision->>'targetClaimRevision')::integer THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PARITY_MISMATCH] Challenge command/result/event differ'
        USING ERRCODE = 'P0001';
    END IF;
    IF p_mutation_kind='challenge.create' THEN
      IF v_expected_revision<>1 OR v_revision->>'state'<>'open'
         OR p_expected_legacy->'challenge'->>'challengeId' IS DISTINCT FROM p_command->>'challengeId'
         OR p_expected_legacy->'challenge'->>'createdBy' IS DISTINCT FROM v_actor_id THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_REVISION_INVALID] Challenge creation must be open revision 1'
          USING ERRCODE = 'P0001';
      END IF;
      v_event_type := 'challenge.created';
    ELSE
      SELECT * INTO v_current_challenge FROM public.challenge_revisions
      WHERE challenge_id=p_command->>'challengeId' ORDER BY revision DESC LIMIT 1 FOR UPDATE;
      v_is_replay := EXISTS (
        SELECT 1 FROM public.challenge_revisions
        WHERE challenge_id=p_command->>'challengeId' AND revision=v_expected_revision
      );
      IF NOT v_is_replay AND (
        v_current_challenge.challenge_id IS NULL
        OR v_expected_revision IS DISTINCT FROM v_current_challenge.revision+1
        OR v_event->'payload'->>'from_state' IS DISTINCT FROM v_current_challenge.state::text
        OR v_event->'payload'->>'to_state' IS DISTINCT FROM v_revision->>'state'
        OR v_revision->>'targetClaimId' IS DISTINCT FROM v_current_challenge.target_claim_id
        OR (v_revision->>'targetClaimRevision')::integer IS DISTINCT FROM v_current_challenge.target_claim_revision
        OR NOT (CASE v_current_challenge.state::text
          WHEN 'open' THEN v_revision->>'state'='admissible'
          WHEN 'admissible' THEN v_revision->>'state'='investigating'
          WHEN 'investigating' THEN v_revision->>'state' IN ('upheld','rejected','resolved')
          ELSE false END)
      ) THEN
        RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_REVISION_RACE] current Challenge revision or transition changed after planning'
          USING ERRCODE = 'P0001';
      END IF;
      v_event_type := CASE WHEN v_revision->>'state'='upheld' THEN 'challenge.upheld' ELSE 'challenge.state_changed' END;
    END IF;
    SELECT question.project_id INTO v_project_id
    FROM public.claim_revisions AS revision JOIN public.claims AS claim USING(claim_id)
    JOIN public.questions AS question ON question.question_id=claim.question_id
    WHERE revision.claim_id=v_revision->>'targetClaimId' AND revision.revision=(v_revision->>'targetClaimRevision')::integer;
    IF v_project_id IS NULL OR (v_fallback_project_id IS NOT NULL AND v_fallback_project_id IS DISTINCT FROM v_project_id) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_PROJECT_UNRESOLVED] Challenge target requires one exact project'
        USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.assert_research_graph_dual_write_role(
      v_project_id,v_actor_id,v_actor_role,CASE WHEN p_mutation_kind='challenge.create' THEN 'contributor' ELSE 'maintainer' END
    );
    v_event_id := private.persist_verified_research_event(v_event,v_event_type,v_actor_id);
    v_event_hash := v_event->>'hash';
    SELECT created_at INTO v_created_at FROM public.research_events WHERE event_id=v_event_id;
    IF p_mutation_kind='challenge.create' THEN
      INSERT INTO public.challenges (challenge_id,created_by,created_at)
      VALUES (p_command->>'challengeId',v_actor_id,v_created_at) ON CONFLICT DO NOTHING;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE challenge_id=p_command->>'challengeId') THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT] Challenge stable row is missing'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.challenge_revisions (
      challenge_id,revision,state,target_claim_id,target_claim_revision,reason,impact,proposed_resolution,created_by,created_at
    ) VALUES (
      p_command->>'challengeId',v_expected_revision,(v_revision->>'state')::public.challenge_state,
      v_revision->>'targetClaimId',(v_revision->>'targetClaimRevision')::integer,v_revision->>'reason',v_revision->'impact',
      NULLIF(v_revision->>'proposedResolution',''),v_actor_id,v_created_at
    ) ON CONFLICT DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.challenge_revisions WHERE challenge_id=p_command->>'challengeId' AND revision=v_expected_revision
        AND state::text=v_revision->>'state' AND target_claim_id=v_revision->>'targetClaimId'
        AND target_claim_revision=(v_revision->>'targetClaimRevision')::integer AND reason=v_revision->>'reason'
        AND impact=v_revision->'impact' AND proposed_resolution IS NOT DISTINCT FROM NULLIF(v_revision->>'proposedResolution','')
        AND created_by=v_actor_id AND created_at=v_created_at
    ) THEN
      RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_LEGACY_CONFLICT] Challenge revision differs'
        USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.insert_research_graph_dual_write_node(
      'challenge',p_command->>'challengeId',v_expected_revision,v_project_id,v_actor_id,v_event_id,v_event_hash,v_created_at,
      'Challenge: '||(v_revision->>'reason'),'published','/challenges/'||(p_command->>'challengeId'),v_revision,
      jsonb_build_object('command',p_command,'legacy',p_expected_legacy,'event',v_event)
    );
    v_item := jsonb_build_object(
      'type','challenges','sourceKind','claim','sourceId',v_revision->>'targetClaimId','sourceRevision',(v_revision->>'targetClaimRevision')::integer,
      'targetKind','challenge','targetId',p_command->>'challengeId','targetRevision',v_expected_revision
    );
    PERFORM private.insert_research_graph_dual_write_edge(
      'dual_edge:challenges:'||v_event_id,'challenges','claim',v_revision->>'targetClaimId',(v_revision->>'targetClaimRevision')::integer,
      'challenge',p_command->>'challengeId',v_expected_revision,v_event_id,v_actor_id,v_created_at
    );
    PERFORM private.insert_research_graph_dual_write_relation_crosswalk(
      'dual_relation:'||v_event_id,v_project_id,'challenge_revision',(p_command->>'challengeId')||'@'||v_expected_revision::text,
      jsonb_build_object('command',p_command,'legacy',p_expected_legacy,'event',v_event),v_event_hash,'direct',NULL,NULL,NULL,
      'dual_edge:challenges:'||v_event_id
    );
    v_kernel_nodes := jsonb_build_array(jsonb_build_object('kind','challenge','id',p_command->>'challengeId','revision',v_expected_revision));
    v_kernel_edges := jsonb_build_array(v_item);
    IF v_expected_revision>1 THEN
      v_kernel_edges := v_kernel_edges||jsonb_build_array(jsonb_build_object(
        'type','supersedes','sourceKind','challenge','sourceId',p_command->>'challengeId','sourceRevision',v_expected_revision-1,
        'targetKind','challenge','targetId',p_command->>'challengeId','targetRevision',v_expected_revision
      ));
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'legacy',p_expected_legacy,
    'kernel',jsonb_build_object('nodes',v_kernel_nodes,'edges',v_kernel_edges),
    'parity',true
  );
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.execute_research_graph_legacy_dual_write(
  p_mutation_kind text,
  p_command jsonb,
  p_verified_events jsonb,
  p_expected_legacy jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'service_role'
     AND COALESCE(current_setting('request.jwt.claim.role',true),'') <> 'service_role' THEN
    RAISE EXCEPTION '[RESEARCH_GRAPH_DUAL_WRITE_SERVICE_ROLE_REQUIRED] service role is required'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN private.execute_research_graph_legacy_dual_write(
    p_mutation_kind,p_command,p_verified_events,p_expected_legacy
  );
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.execute_research_graph_legacy_dual_write(text,jsonb,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.research_graph_dual_write_hash(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.research_graph_events_semantically_equal(jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.persist_verified_research_event(jsonb,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.insert_research_graph_dual_write_edge(text,private.research_edge_type,private.research_node_kind,text,integer,private.research_node_kind,text,integer,text,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.insert_research_graph_dual_write_node_crosswalk(text,private.research_node_kind,text,integer,jsonb,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.insert_research_graph_dual_write_relation_crosswalk(text,text,private.legacy_relation_source,text,jsonb,text,private.legacy_mapping_kind,private.research_node_kind,text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.insert_research_graph_dual_write_node(private.research_node_kind,text,integer,text,text,text,text,timestamptz,text,private.research_document_state,text,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.insert_research_graph_dual_write_evaluation(text,text,text,integer,private.evaluation_stance,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.assert_research_graph_dual_write_role(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.execute_research_graph_legacy_dual_write(text,jsonb,jsonb,jsonb) FROM PUBLIC;
--> statement-breakpoint
DO $research_graph_dual_write_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON FUNCTION public.execute_research_graph_legacy_dual_write(text,jsonb,jsonb,jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON FUNCTION public.execute_research_graph_legacy_dual_write(text,jsonb,jsonb,jsonb) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    GRANT EXECUTE ON FUNCTION public.execute_research_graph_legacy_dual_write(text,jsonb,jsonb,jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION private.execute_research_graph_legacy_dual_write(text,jsonb,jsonb,jsonb) TO service_role;
  END IF;
END
$research_graph_dual_write_grants$;
