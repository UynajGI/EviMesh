CREATE SCHEMA IF NOT EXISTS "private";
--> statement-breakpoint
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Revoke that
-- creator-wide default before any kernel helper exists; every callable surface
-- below must opt back in with an explicit least-privilege GRANT.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
CREATE TYPE "private"."evaluation_stance" AS ENUM('supports', 'refutes', 'qualifies', 'reproduces', 'verifies');--> statement-breakpoint
CREATE TYPE "private"."legacy_mapping_kind" AS ENUM('direct', 'evaluation', 'rebuttal', 'archive');--> statement-breakpoint
CREATE TYPE "private"."legacy_mapping_status" AS ENUM('mapped', 'quarantined', 'archived');--> statement-breakpoint
CREATE TYPE "private"."legacy_relation_source" AS ENUM('claim_relation', 'evidence_claim_link', 'challenge_impact', 'task_dependency', 'run_input', 'run_output');--> statement-breakpoint
CREATE TYPE "private"."migration_finding_severity" AS ENUM('blocking', 'warning');--> statement-breakpoint
CREATE TYPE "private"."migration_finding_status" AS ENUM('active', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "private"."migration_finding_type" AS ENUM('cycle', 'self_loop', 'dangling_revision', 'run_io_overlap', 'unmapped_relation');--> statement-breakpoint
CREATE TYPE "private"."research_document_state" AS ENUM('draft', 'published', 'superseded', 'retracted');--> statement-breakpoint
CREATE TYPE "private"."research_edge_type" AS ENUM('extends_question', 'answers', 'yields_claim', 'rebuts', 'grounds_rebuttal', 'evaluates', 'evaluation_basis', 'challenges', 'uses_dataset', 'uses_tool', 'uses_artifact', 'materializes_dataset', 'packages_tool', 'operationalizes', 'attempted_as', 'produces_run', 'context_for', 'run_input', 'produces_artifact', 'produces_evidence', 'requires', 'derived_from', 'extends', 'implements', 'supersedes');--> statement-breakpoint
CREATE TYPE "private"."research_node_kind" AS ENUM('project', 'research_contract', 'question', 'answer', 'claim', 'rebuttal', 'evaluation', 'dataset', 'tool', 'artifact', 'evidence', 'task', 'attempt', 'context_bundle', 'run', 'verification_contract', 'verification_policy', 'policy_evaluation', 'verification_receipt', 'verification_finding', 'challenge', 'merge_proposal', 'frontier_snapshot');--> statement-breakpoint
CREATE TYPE "private"."tool_kind" AS ENUM('skill', 'method', 'software', 'model', 'workflow');--> statement-breakpoint
CREATE SEQUENCE "private"."research_commit_rank_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "private"."answer_revisions" (
	"answer_id" text NOT NULL,
	"revision" integer NOT NULL,
	"node_kind" "private"."research_node_kind" DEFAULT 'answer' NOT NULL,
	"title" text NOT NULL,
	"synthesis" text NOT NULL,
	"limitations" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	CONSTRAINT "answer_revisions_pkey" PRIMARY KEY("answer_id","revision"),
	CONSTRAINT "answer_revisions_kind_fixed" CHECK ("private"."answer_revisions"."node_kind" = 'answer'),
	CONSTRAINT "answer_revisions_content_nonempty" CHECK ("private"."answer_revisions"."title" <> '' AND "private"."answer_revisions"."synthesis" <> '')
);
--> statement-breakpoint
CREATE TABLE "private"."dataset_revisions" (
	"dataset_id" text NOT NULL,
	"revision" integer NOT NULL,
	"node_kind" "private"."research_node_kind" DEFAULT 'dataset' NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"version" text NOT NULL,
	"license" text NOT NULL,
	"schema_uri" text,
	"provenance" text NOT NULL,
	"artifact_kind" "private"."research_node_kind" DEFAULT 'artifact' NOT NULL,
	"artifact_id" text NOT NULL,
	"artifact_revision" integer NOT NULL,
	CONSTRAINT "dataset_revisions_pkey" PRIMARY KEY("dataset_id","revision"),
	CONSTRAINT "dataset_revisions_kind_fixed" CHECK ("private"."dataset_revisions"."node_kind" = 'dataset'),
	CONSTRAINT "dataset_revisions_artifact_kind_fixed" CHECK ("private"."dataset_revisions"."artifact_kind" = 'artifact'),
	CONSTRAINT "dataset_revisions_content_nonempty" CHECK ("private"."dataset_revisions"."name" <> '' AND "private"."dataset_revisions"."description" <> '' AND "private"."dataset_revisions"."version" <> '' AND "private"."dataset_revisions"."license" <> '' AND "private"."dataset_revisions"."provenance" <> '')
);
--> statement-breakpoint
CREATE TABLE "private"."evaluation_bases" (
	"evaluation_id" text NOT NULL,
	"evaluation_revision" integer NOT NULL,
	"basis_kind" "private"."research_node_kind" NOT NULL,
	"basis_id" text NOT NULL,
	"basis_revision" integer NOT NULL,
	CONSTRAINT "evaluation_bases_pkey" PRIMARY KEY("evaluation_id","evaluation_revision","basis_kind","basis_id","basis_revision"),
	CONSTRAINT "evaluation_bases_kind_allowed" CHECK ("private"."evaluation_bases"."basis_kind" IN ('claim', 'evidence', 'run', 'dataset', 'artifact'))
);
--> statement-breakpoint
CREATE TABLE "private"."evaluation_revisions" (
	"evaluation_id" text NOT NULL,
	"revision" integer NOT NULL,
	"node_kind" "private"."research_node_kind" DEFAULT 'evaluation' NOT NULL,
	"subject_kind" "private"."research_node_kind" NOT NULL,
	"subject_id" text NOT NULL,
	"subject_revision" integer NOT NULL,
	"stance" "private"."evaluation_stance" NOT NULL,
	"rationale" text NOT NULL,
	"method" text,
	CONSTRAINT "evaluation_revisions_pkey" PRIMARY KEY("evaluation_id","revision"),
	CONSTRAINT "evaluation_revisions_kind_fixed" CHECK ("private"."evaluation_revisions"."node_kind" = 'evaluation'),
	CONSTRAINT "evaluation_revisions_subject_claim" CHECK ("private"."evaluation_revisions"."subject_kind" = 'claim'),
	CONSTRAINT "evaluation_revisions_rationale_nonempty" CHECK ("private"."evaluation_revisions"."rationale" <> '')
);
--> statement-breakpoint
CREATE TABLE "private"."legacy_relation_records" (
	"mapping_id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source" "private"."legacy_relation_source" NOT NULL,
	"source_key" text NOT NULL,
	"source_payload" jsonb NOT NULL,
	"source_checksum" text NOT NULL,
	"mapping_kind" "private"."legacy_mapping_kind" NOT NULL,
	"status" "private"."legacy_mapping_status" NOT NULL,
	"mapped_node_kind" "private"."research_node_kind",
	"mapped_node_id" text,
	"mapped_node_revision" integer,
	"mapped_edge_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_relation_records_checksum_format" CHECK ("private"."legacy_relation_records"."source_checksum" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "legacy_relation_records_mapping_target" CHECK (("private"."legacy_relation_records"."mapping_kind" IN ('evaluation', 'rebuttal') AND "private"."legacy_relation_records"."mapped_node_kind" IS NOT NULL AND "private"."legacy_relation_records"."mapped_node_id" IS NOT NULL AND "private"."legacy_relation_records"."mapped_node_revision" IS NOT NULL) OR ("private"."legacy_relation_records"."mapping_kind" = 'direct' AND "private"."legacy_relation_records"."mapped_edge_id" IS NOT NULL) OR ("private"."legacy_relation_records"."mapping_kind" = 'archive' AND "private"."legacy_relation_records"."status" IN ('quarantined', 'archived')))
);
--> statement-breakpoint
CREATE TABLE "private"."rebuttal_revisions" (
	"rebuttal_id" text NOT NULL,
	"revision" integer NOT NULL,
	"node_kind" "private"."research_node_kind" DEFAULT 'rebuttal' NOT NULL,
	"title" text NOT NULL,
	"argument" text NOT NULL,
	"scope" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	CONSTRAINT "rebuttal_revisions_pkey" PRIMARY KEY("rebuttal_id","revision"),
	CONSTRAINT "rebuttal_revisions_kind_fixed" CHECK ("private"."rebuttal_revisions"."node_kind" = 'rebuttal'),
	CONSTRAINT "rebuttal_revisions_content_nonempty" CHECK ("private"."rebuttal_revisions"."title" <> '' AND "private"."rebuttal_revisions"."argument" <> '')
);
--> statement-breakpoint
CREATE TABLE "private"."research_edges" (
	"edge_id" text PRIMARY KEY NOT NULL,
	"edge_type" "private"."research_edge_type" NOT NULL,
	"source_kind" "private"."research_node_kind" NOT NULL,
	"source_id" text NOT NULL,
	"source_revision" integer NOT NULL,
	"source_commit_rank" bigint NOT NULL,
	"source_batch_rank" integer NOT NULL,
	"target_kind" "private"."research_node_kind" NOT NULL,
	"target_id" text NOT NULL,
	"target_revision" integer NOT NULL,
	"target_commit_rank" bigint NOT NULL,
	"target_batch_rank" integer NOT NULL,
	"provenance_event_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_edges_forward_rank" CHECK (ROW("private"."research_edges"."source_commit_rank", "private"."research_edges"."source_batch_rank") < ROW("private"."research_edges"."target_commit_rank", "private"."research_edges"."target_batch_rank")),
	CONSTRAINT "research_edges_revision_positive" CHECK ("private"."research_edges"."source_revision" > 0 AND "private"."research_edges"."target_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "private"."research_graph_migration_findings" (
	"finding_id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"finding_type" "private"."migration_finding_type" NOT NULL,
	"severity" "private"."migration_finding_severity" NOT NULL,
	"status" "private"."migration_finding_status" DEFAULT 'active' NOT NULL,
	"member_refs" jsonb NOT NULL,
	"details" text NOT NULL,
	"legacy_mapping_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	CONSTRAINT "research_graph_migration_findings_details_nonempty" CHECK ("private"."research_graph_migration_findings"."details" <> ''),
	CONSTRAINT "research_graph_migration_findings_resolution_complete" CHECK (("private"."research_graph_migration_findings"."status" = 'active' AND "private"."research_graph_migration_findings"."resolved_at" IS NULL AND "private"."research_graph_migration_findings"."resolved_by" IS NULL) OR ("private"."research_graph_migration_findings"."status" IN ('resolved', 'archived') AND "private"."research_graph_migration_findings"."resolved_at" IS NOT NULL AND "private"."research_graph_migration_findings"."resolved_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "private"."research_node_revisions" (
	"node_kind" "private"."research_node_kind" NOT NULL,
	"node_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes_revision" integer,
	"commit_rank" bigint DEFAULT nextval('private.research_commit_rank_seq') NOT NULL,
	"batch_rank" integer DEFAULT 1 NOT NULL,
	"canonical_content_hash" text NOT NULL,
	"label" text NOT NULL,
	"state" "private"."research_document_state" DEFAULT 'draft' NOT NULL,
	"canonical_href" text NOT NULL,
	"source_event_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_node_revisions_pkey" PRIMARY KEY("node_kind","node_id","revision"),
	CONSTRAINT "research_node_revisions_rank_ref_unique" UNIQUE("node_kind","node_id","revision","commit_rank","batch_rank"),
	CONSTRAINT "research_node_revisions_revision_positive" CHECK ("private"."research_node_revisions"."revision" > 0),
	CONSTRAINT "research_node_revisions_rank_positive" CHECK ("private"."research_node_revisions"."commit_rank" > 0 AND "private"."research_node_revisions"."batch_rank" > 0),
	CONSTRAINT "research_node_revisions_hash_format" CHECK ("private"."research_node_revisions"."canonical_content_hash" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "research_node_revisions_label_nonempty" CHECK ("private"."research_node_revisions"."label" <> ''),
	CONSTRAINT "research_node_revisions_href_absolute" CHECK ("private"."research_node_revisions"."canonical_href" ~ '^/'),
	CONSTRAINT "research_node_revisions_supersedes_previous" CHECK (("private"."research_node_revisions"."revision" = 1 AND "private"."research_node_revisions"."supersedes_revision" IS NULL) OR ("private"."research_node_revisions"."revision" > 1 AND "private"."research_node_revisions"."supersedes_revision" = "private"."research_node_revisions"."revision" - 1))
);
--> statement-breakpoint
CREATE TABLE "private"."research_nodes" (
	"node_id" text PRIMARY KEY NOT NULL,
	"node_kind" "private"."research_node_kind" NOT NULL,
	"project_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "research_nodes_kind_id_unique" UNIQUE("node_kind","node_id"),
	CONSTRAINT "research_nodes_id_nonempty" CHECK ("private"."research_nodes"."node_id" <> ''),
	CONSTRAINT "research_nodes_retirement_ordered" CHECK ("private"."research_nodes"."retired_at" IS NULL OR "private"."research_nodes"."retired_at" >= "private"."research_nodes"."created_at")
);
--> statement-breakpoint
CREATE TABLE "private"."tool_revisions" (
	"tool_id" text NOT NULL,
	"revision" integer NOT NULL,
	"node_kind" "private"."research_node_kind" DEFAULT 'tool' NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"tool_kind" "private"."tool_kind" NOT NULL,
	"version" text NOT NULL,
	"runtime" text NOT NULL,
	"input_schema_uri" text,
	"output_schema_uri" text,
	"license" text NOT NULL,
	"provenance" text NOT NULL,
	"artifact_kind" "private"."research_node_kind",
	"artifact_id" text,
	"artifact_revision" integer,
	CONSTRAINT "tool_revisions_pkey" PRIMARY KEY("tool_id","revision"),
	CONSTRAINT "tool_revisions_kind_fixed" CHECK ("private"."tool_revisions"."node_kind" = 'tool'),
	CONSTRAINT "tool_revisions_artifact_ref_complete" CHECK (("private"."tool_revisions"."artifact_kind" IS NULL AND "private"."tool_revisions"."artifact_id" IS NULL AND "private"."tool_revisions"."artifact_revision" IS NULL) OR ("private"."tool_revisions"."artifact_kind" = 'artifact' AND "private"."tool_revisions"."artifact_id" IS NOT NULL AND "private"."tool_revisions"."artifact_revision" > 0)),
	CONSTRAINT "tool_revisions_content_nonempty" CHECK ("private"."tool_revisions"."name" <> '' AND "private"."tool_revisions"."description" <> '' AND "private"."tool_revisions"."version" <> '' AND "private"."tool_revisions"."runtime" <> '' AND "private"."tool_revisions"."license" <> '' AND "private"."tool_revisions"."provenance" <> '')
);
--> statement-breakpoint
ALTER TABLE "private"."answer_revisions" ADD CONSTRAINT "answer_revisions_node_fk" FOREIGN KEY ("node_kind","answer_id","revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."dataset_revisions" ADD CONSTRAINT "dataset_revisions_node_fk" FOREIGN KEY ("node_kind","dataset_id","revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."dataset_revisions" ADD CONSTRAINT "dataset_revisions_artifact_fk" FOREIGN KEY ("artifact_kind","artifact_id","artifact_revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."evaluation_bases" ADD CONSTRAINT "evaluation_bases_evaluation_fk" FOREIGN KEY ("evaluation_id","evaluation_revision") REFERENCES "private"."evaluation_revisions"("evaluation_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."evaluation_bases" ADD CONSTRAINT "evaluation_bases_basis_fk" FOREIGN KEY ("basis_kind","basis_id","basis_revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."evaluation_revisions" ADD CONSTRAINT "evaluation_revisions_node_fk" FOREIGN KEY ("node_kind","evaluation_id","revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."evaluation_revisions" ADD CONSTRAINT "evaluation_revisions_subject_fk" FOREIGN KEY ("subject_kind","subject_id","subject_revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."legacy_relation_records" ADD CONSTRAINT "legacy_relation_records_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."legacy_relation_records" ADD CONSTRAINT "legacy_relation_records_mapped_node_fk" FOREIGN KEY ("mapped_node_kind","mapped_node_id","mapped_node_revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."legacy_relation_records" ADD CONSTRAINT "legacy_relation_records_mapped_edge_fk" FOREIGN KEY ("mapped_edge_id") REFERENCES "private"."research_edges"("edge_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."rebuttal_revisions" ADD CONSTRAINT "rebuttal_revisions_node_fk" FOREIGN KEY ("node_kind","rebuttal_id","revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_edges" ADD CONSTRAINT "research_edges_provenance_event_id_research_events_event_id_fk" FOREIGN KEY ("provenance_event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_edges" ADD CONSTRAINT "research_edges_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_edges" ADD CONSTRAINT "research_edges_source_revision_fk" FOREIGN KEY ("source_kind","source_id","source_revision","source_commit_rank","source_batch_rank") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision","commit_rank","batch_rank") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_edges" ADD CONSTRAINT "research_edges_target_revision_fk" FOREIGN KEY ("target_kind","target_id","target_revision","target_commit_rank","target_batch_rank") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision","commit_rank","batch_rank") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_graph_migration_findings" ADD CONSTRAINT "research_graph_migration_findings_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_graph_migration_findings" ADD CONSTRAINT "research_graph_migration_findings_legacy_mapping_id_legacy_relation_records_mapping_id_fk" FOREIGN KEY ("legacy_mapping_id") REFERENCES "private"."legacy_relation_records"("mapping_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_graph_migration_findings" ADD CONSTRAINT "research_graph_migration_findings_resolved_by_actors_actor_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_node_revisions" ADD CONSTRAINT "research_node_revisions_source_event_id_research_events_event_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_node_revisions" ADD CONSTRAINT "research_node_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_node_revisions" ADD CONSTRAINT "research_node_revisions_node_fk" FOREIGN KEY ("node_kind","node_id") REFERENCES "private"."research_nodes"("node_kind","node_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_node_revisions" ADD CONSTRAINT "research_node_revisions_supersedes_fk" FOREIGN KEY ("node_kind","node_id","supersedes_revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_nodes" ADD CONSTRAINT "research_nodes_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_nodes" ADD CONSTRAINT "research_nodes_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."tool_revisions" ADD CONSTRAINT "tool_revisions_node_fk" FOREIGN KEY ("node_kind","tool_id","revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."tool_revisions" ADD CONSTRAINT "tool_revisions_artifact_fk" FOREIGN KEY ("artifact_kind","artifact_id","artifact_revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dataset_revisions_artifact_idx" ON "private"."dataset_revisions" USING btree ("artifact_kind","artifact_id","artifact_revision");--> statement-breakpoint
CREATE INDEX "evaluation_bases_basis_idx" ON "private"."evaluation_bases" USING btree ("basis_kind","basis_id","basis_revision");--> statement-breakpoint
CREATE INDEX "evaluation_revisions_subject_idx" ON "private"."evaluation_revisions" USING btree ("subject_kind","subject_id","subject_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_relation_records_source_unique" ON "private"."legacy_relation_records" USING btree ("source","source_key");--> statement-breakpoint
CREATE INDEX "legacy_relation_records_project_status_idx" ON "private"."legacy_relation_records" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "research_edges_unique" ON "private"."research_edges" USING btree ("edge_type","source_kind","source_id","source_revision","target_kind","target_id","target_revision");--> statement-breakpoint
CREATE INDEX "research_edges_source_idx" ON "private"."research_edges" USING btree ("source_kind","source_id","source_revision");--> statement-breakpoint
CREATE INDEX "research_edges_target_idx" ON "private"."research_edges" USING btree ("target_kind","target_id","target_revision");--> statement-breakpoint
CREATE INDEX "research_edges_event_idx" ON "private"."research_edges" USING btree ("provenance_event_id");--> statement-breakpoint
CREATE INDEX "research_graph_migration_findings_project_status_idx" ON "private"."research_graph_migration_findings" USING btree ("project_id","status","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "research_node_revisions_rank_unique" ON "private"."research_node_revisions" USING btree ("commit_rank","batch_rank");--> statement-breakpoint
CREATE INDEX "research_node_revisions_node_current_idx" ON "private"."research_node_revisions" USING btree ("node_kind","node_id","revision");--> statement-breakpoint
CREATE INDEX "research_node_revisions_event_idx" ON "private"."research_node_revisions" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "research_nodes_project_kind_idx" ON "private"."research_nodes" USING btree ("project_id","node_kind");--> statement-breakpoint
CREATE INDEX "tool_revisions_artifact_idx" ON "private"."tool_revisions" USING btree ("artifact_kind","artifact_id","artifact_revision");
--> statement-breakpoint
-- Allocate one transaction-wide commit rank; callers assign deterministic
-- batch ranks to every new immutable revision in the signed mutation.
CREATE OR REPLACE FUNCTION private.allocate_research_commit_rank()
RETURNS bigint
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT nextval('private.research_commit_rank_seq') $$;
--> statement-breakpoint
-- The endpoint matrix is database authority as well as protocol metadata.
-- Callers cannot create a new relation name or relax its endpoint kinds.
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
    WHEN 'operationalizes' THEN NEW.source_kind IN ('question', 'answer', 'claim') AND NEW.target_kind = 'task'
    WHEN 'attempted_as' THEN NEW.source_kind = 'task' AND NEW.target_kind = 'attempt'
    WHEN 'produces_run' THEN NEW.source_kind = 'attempt' AND NEW.target_kind = 'run'
    WHEN 'context_for' THEN NEW.source_kind = 'context_bundle' AND NEW.target_kind = 'run'
    WHEN 'run_input' THEN NEW.source_kind IN ('dataset', 'tool', 'artifact', 'context_bundle') AND NEW.target_kind = 'run'
    WHEN 'produces_artifact' THEN NEW.source_kind = 'run' AND NEW.target_kind = 'artifact'
    WHEN 'produces_evidence' THEN NEW.source_kind = 'run' AND NEW.target_kind = 'evidence'
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
CREATE TRIGGER research_edges_registry_trigger
BEFORE INSERT ON private.research_edges
FOR EACH ROW EXECUTE FUNCTION private.enforce_research_edge_registry();
--> statement-breakpoint
-- Revision vertices, relation edges, subtype content, and legacy crosswalks
-- are append-only. Stable research_nodes may only acquire a retired_at value.
CREATE OR REPLACE FUNCTION private.prevent_research_graph_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.protect_research_node_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.node_id IS DISTINCT FROM OLD.node_id
    OR NEW.node_kind IS DISTINCT FROM OLD.node_kind
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at)
  THEN
    RAISE EXCEPTION 'research node identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER research_nodes_identity_trigger BEFORE UPDATE ON private.research_nodes
FOR EACH ROW EXECUTE FUNCTION private.protect_research_node_identity();
--> statement-breakpoint
CREATE TRIGGER research_nodes_no_delete_trigger BEFORE DELETE ON private.research_nodes
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER research_node_revisions_append_only_trigger BEFORE UPDATE OR DELETE ON private.research_node_revisions
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER research_edges_append_only_trigger BEFORE UPDATE OR DELETE ON private.research_edges
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER answer_revisions_append_only_trigger BEFORE UPDATE OR DELETE ON private.answer_revisions
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER rebuttal_revisions_append_only_trigger BEFORE UPDATE OR DELETE ON private.rebuttal_revisions
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER evaluation_revisions_append_only_trigger BEFORE UPDATE OR DELETE ON private.evaluation_revisions
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER evaluation_bases_append_only_trigger BEFORE UPDATE OR DELETE ON private.evaluation_bases
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER dataset_revisions_append_only_trigger BEFORE UPDATE OR DELETE ON private.dataset_revisions
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER tool_revisions_append_only_trigger BEFORE UPDATE OR DELETE ON private.tool_revisions
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
CREATE TRIGGER legacy_relation_records_append_only_trigger BEFORE UPDATE OR DELETE ON private.legacy_relation_records
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
-- Every non-genesis revision is connected to its immediately previous
-- immutable vertex by a same-batch supersedes edge. This prevents a caller
-- from changing relations through an unlinked replacement revision.
CREATE OR REPLACE FUNCTION private.validate_research_revision_lineage_edge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  matching_count integer;
BEGIN
  SELECT count(*) INTO matching_count
  FROM private.research_edges AS edge
  WHERE edge.edge_type = 'supersedes'
    AND edge.source_kind = NEW.node_kind
    AND edge.source_id = NEW.node_id
    AND edge.source_revision = NEW.supersedes_revision
    AND edge.target_kind = NEW.node_kind
    AND edge.target_id = NEW.node_id
    AND edge.target_revision = NEW.revision
    AND edge.provenance_event_id = NEW.source_event_id;

  IF NEW.revision = 1 AND matching_count <> 0 THEN
    RAISE EXCEPTION 'revision 1 cannot carry a supersedes lineage edge' USING ERRCODE = '23514';
  ELSIF NEW.revision > 1 AND matching_count <> 1 THEN
    RAISE EXCEPTION 'non-genesis revision requires exactly one previous revision supersedes edge' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER research_node_revisions_lineage_edge_trigger
AFTER INSERT ON private.research_node_revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_research_revision_lineage_edge();
--> statement-breakpoint
-- Deferred motif checks allow subtype rows and their signed incoming edges to
-- be inserted in either order inside one short transaction, but never commit
-- an incomplete Answer/Rebuttal/Evaluation/Dataset/Tool revision.
CREATE OR REPLACE FUNCTION private.validate_typed_research_motif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  matching_count integer;
  missing_count integer;
BEGIN
  IF TG_TABLE_NAME = 'answer_revisions' THEN
    SELECT count(*) INTO matching_count FROM private.research_edges edge
      WHERE edge.target_kind = 'answer' AND edge.target_id = NEW.answer_id
        AND edge.target_revision = NEW.revision AND edge.edge_type = 'answers';
    IF matching_count <> 1 THEN RAISE EXCEPTION 'Answer revision requires exactly one Question -> Answer edge' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'rebuttal_revisions' THEN
    SELECT count(*) INTO matching_count FROM private.research_edges edge
      WHERE edge.target_kind = 'rebuttal' AND edge.target_id = NEW.rebuttal_id
        AND edge.target_revision = NEW.revision AND edge.edge_type = 'rebuts';
    IF matching_count <> 1 THEN RAISE EXCEPTION 'Rebuttal revision requires exactly one subject -> Rebuttal edge' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'evaluation_revisions' THEN
    SELECT count(*) INTO matching_count FROM private.research_edges edge
      WHERE edge.edge_type = 'evaluates'
        AND edge.source_kind = NEW.subject_kind AND edge.source_id = NEW.subject_id AND edge.source_revision = NEW.subject_revision
        AND edge.target_kind = 'evaluation' AND edge.target_id = NEW.evaluation_id AND edge.target_revision = NEW.revision;
    IF matching_count <> 1 THEN RAISE EXCEPTION 'Evaluation revision requires exactly one matching subject edge' USING ERRCODE = '23514'; END IF;
    SELECT count(*) INTO matching_count FROM private.evaluation_bases basis
      WHERE basis.evaluation_id = NEW.evaluation_id AND basis.evaluation_revision = NEW.revision;
    IF matching_count < 1 THEN RAISE EXCEPTION 'Evaluation revision requires at least one basis' USING ERRCODE = '23514'; END IF;
    SELECT count(*) INTO missing_count FROM private.evaluation_bases basis
      WHERE basis.evaluation_id = NEW.evaluation_id AND basis.evaluation_revision = NEW.revision
        AND NOT EXISTS (SELECT 1 FROM private.research_edges edge
          WHERE edge.edge_type = 'evaluation_basis'
            AND edge.source_kind = basis.basis_kind AND edge.source_id = basis.basis_id AND edge.source_revision = basis.basis_revision
            AND edge.target_kind = 'evaluation' AND edge.target_id = NEW.evaluation_id AND edge.target_revision = NEW.revision);
    IF missing_count <> 0 THEN RAISE EXCEPTION 'Evaluation basis row is missing its matching graph edge' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'dataset_revisions' THEN
    SELECT count(*) INTO matching_count FROM private.research_edges edge
      WHERE edge.edge_type = 'materializes_dataset'
        AND edge.source_kind = NEW.artifact_kind AND edge.source_id = NEW.artifact_id AND edge.source_revision = NEW.artifact_revision
        AND edge.target_kind = 'dataset' AND edge.target_id = NEW.dataset_id AND edge.target_revision = NEW.revision;
    IF matching_count <> 1 THEN RAISE EXCEPTION 'Dataset revision requires exactly one matching Artifact edge' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'tool_revisions' AND NEW.artifact_id IS NOT NULL THEN
    SELECT count(*) INTO matching_count FROM private.research_edges edge
      WHERE edge.edge_type = 'packages_tool'
        AND edge.source_kind = NEW.artifact_kind AND edge.source_id = NEW.artifact_id AND edge.source_revision = NEW.artifact_revision
        AND edge.target_kind = 'tool' AND edge.target_id = NEW.tool_id AND edge.target_revision = NEW.revision;
    IF matching_count <> 1 THEN RAISE EXCEPTION 'Packaged Tool revision requires exactly one matching Artifact edge' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER answer_revisions_motif_trigger AFTER INSERT ON private.answer_revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_typed_research_motif();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER rebuttal_revisions_motif_trigger AFTER INSERT ON private.rebuttal_revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_typed_research_motif();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER evaluation_revisions_motif_trigger AFTER INSERT ON private.evaluation_revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_typed_research_motif();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER dataset_revisions_motif_trigger AFTER INSERT ON private.dataset_revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_typed_research_motif();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER tool_revisions_motif_trigger AFTER INSERT ON private.tool_revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.validate_typed_research_motif();
--> statement-breakpoint
-- Public read projections are security-invoker views. They expose no typed
-- content or mutation function and obey RLS on the private kernel tables.
CREATE OR REPLACE VIEW public.research_graph_nodes
WITH (security_invoker = true)
AS
SELECT
  revision.node_kind::text AS node_kind,
  revision.node_id,
  revision.revision,
  node.project_id,
  revision.label,
  revision.state::text AS state,
  revision.canonical_href,
  revision.created_at,
  revision.created_by,
  revision.commit_rank,
  revision.batch_rank,
  revision.revision = max(revision.revision) OVER (PARTITION BY revision.node_kind, revision.node_id) AS is_current
FROM private.research_node_revisions AS revision
JOIN private.research_nodes AS node
  ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
WHERE node.retired_at IS NULL;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.research_graph_edges
WITH (security_invoker = true)
AS
SELECT
  edge.edge_id,
  edge.edge_type::text AS edge_type,
  edge.source_kind::text AS source_kind,
  edge.source_id,
  edge.source_revision,
  edge.target_kind::text AS target_kind,
  edge.target_id,
  edge.target_revision,
  edge.provenance_event_id,
  edge.created_by,
  edge.created_at
FROM private.research_edges AS edge;
--> statement-breakpoint
-- Strongly typed read projections expose every immutable revision while
-- keeping subtype tables outside the exposed Data API schemas. Callers may
-- select is_current for list/detail projections without losing revision
-- history.
CREATE OR REPLACE VIEW public.research_answers
WITH (security_invoker = true)
AS
SELECT
  revision.node_id,
  answer.answer_id,
  revision.revision,
  revision.supersedes_revision,
  node.project_id,
  revision.state::text AS state,
  revision.label,
  revision.canonical_href,
  revision.created_at,
  revision.created_by,
  revision.revision = max(revision.revision) OVER (PARTITION BY revision.node_kind, revision.node_id) AS is_current,
  answer.title,
  answer.synthesis,
  answer.limitations
FROM private.answer_revisions AS answer
JOIN private.research_node_revisions AS revision
  ON revision.node_kind = answer.node_kind AND revision.node_id = answer.answer_id AND revision.revision = answer.revision
JOIN private.research_nodes AS node
  ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
WHERE node.retired_at IS NULL;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.research_rebuttals
WITH (security_invoker = true)
AS
SELECT
  revision.node_id,
  rebuttal.rebuttal_id,
  revision.revision,
  revision.supersedes_revision,
  node.project_id,
  revision.state::text AS state,
  revision.label,
  revision.canonical_href,
  revision.created_at,
  revision.created_by,
  revision.revision = max(revision.revision) OVER (PARTITION BY revision.node_kind, revision.node_id) AS is_current,
  rebuttal.title,
  rebuttal.argument,
  rebuttal.scope
FROM private.rebuttal_revisions AS rebuttal
JOIN private.research_node_revisions AS revision
  ON revision.node_kind = rebuttal.node_kind AND revision.node_id = rebuttal.rebuttal_id AND revision.revision = rebuttal.revision
JOIN private.research_nodes AS node
  ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
WHERE node.retired_at IS NULL;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.research_evaluations
WITH (security_invoker = true)
AS
SELECT
  revision.node_id,
  evaluation.evaluation_id,
  revision.revision,
  revision.supersedes_revision,
  node.project_id,
  revision.state::text AS state,
  revision.label,
  revision.canonical_href,
  revision.created_at,
  revision.created_by,
  revision.revision = max(revision.revision) OVER (PARTITION BY revision.node_kind, revision.node_id) AS is_current,
  evaluation.subject_kind::text AS subject_kind,
  evaluation.subject_id,
  evaluation.subject_revision,
  evaluation.stance::text AS stance,
  evaluation.rationale,
  evaluation.method
FROM private.evaluation_revisions AS evaluation
JOIN private.research_node_revisions AS revision
  ON revision.node_kind = evaluation.node_kind AND revision.node_id = evaluation.evaluation_id AND revision.revision = evaluation.revision
JOIN private.research_nodes AS node
  ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
WHERE node.retired_at IS NULL;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.research_datasets
WITH (security_invoker = true)
AS
SELECT
  revision.node_id,
  dataset.dataset_id,
  revision.revision,
  revision.supersedes_revision,
  node.project_id,
  revision.state::text AS state,
  revision.label,
  revision.canonical_href,
  revision.created_at,
  revision.created_by,
  revision.revision = max(revision.revision) OVER (PARTITION BY revision.node_kind, revision.node_id) AS is_current,
  dataset.name,
  dataset.description,
  dataset.version,
  dataset.license,
  dataset.schema_uri,
  dataset.provenance,
  dataset.artifact_id,
  dataset.artifact_revision
FROM private.dataset_revisions AS dataset
JOIN private.research_node_revisions AS revision
  ON revision.node_kind = dataset.node_kind AND revision.node_id = dataset.dataset_id AND revision.revision = dataset.revision
JOIN private.research_nodes AS node
  ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
WHERE node.retired_at IS NULL;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.research_tools
WITH (security_invoker = true)
AS
SELECT
  revision.node_id,
  tool.tool_id,
  revision.revision,
  revision.supersedes_revision,
  node.project_id,
  revision.state::text AS state,
  revision.label,
  revision.canonical_href,
  revision.created_at,
  revision.created_by,
  revision.revision = max(revision.revision) OVER (PARTITION BY revision.node_kind, revision.node_id) AS is_current,
  tool.name,
  tool.description,
  tool.tool_kind::text AS tool_kind,
  tool.version,
  tool.runtime,
  tool.input_schema_uri,
  tool.output_schema_uri,
  tool.license,
  tool.provenance,
  tool.artifact_id,
  tool.artifact_revision
FROM private.tool_revisions AS tool
JOIN private.research_node_revisions AS revision
  ON revision.node_kind = tool.node_kind AND revision.node_id = tool.tool_id AND revision.revision = tool.revision
JOIN private.research_nodes AS node
  ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
WHERE node.retired_at IS NULL;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.research_evaluation_bases
WITH (security_invoker = true)
AS
SELECT
  basis.evaluation_id,
  basis.evaluation_revision,
  basis.basis_kind::text AS basis_kind,
  basis.basis_id,
  basis.basis_revision
FROM private.evaluation_bases AS basis;
--> statement-breakpoint
-- Explicit grants are bundled with RLS because new Supabase projects no
-- longer auto-expose tables. Anonymous Data API callers receive no direct
-- mutation access. Anonymous callers can read active, non-deleted projects;
-- authenticated callers additionally see projects linked to their Actor
-- membership. Private/draft rows and hidden edge counts remain protected by
-- endpoint-complete RLS. No browser role receives mutation or sequence access.
DO $security$
DECLARE
  table_name text;
  all_tables constant text[] := ARRAY[
    'research_nodes', 'research_node_revisions', 'research_edges',
    'answer_revisions', 'rebuttal_revisions', 'evaluation_revisions',
    'evaluation_bases', 'dataset_revisions', 'tool_revisions',
    'legacy_relation_records', 'research_graph_migration_findings'
  ];
BEGIN
  FOREACH table_name IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE private.%I FROM PUBLIC', table_name);
  END LOOP;
  REVOKE ALL ON
    public.research_graph_nodes, public.research_graph_edges,
    public.research_answers, public.research_rebuttals,
    public.research_evaluations, public.research_evaluation_bases,
    public.research_datasets, public.research_tools
  FROM PUBLIC;
  REVOKE ALL ON SEQUENCE private.research_commit_rank_seq FROM PUBLIC;
  REVOKE ALL ON FUNCTION private.allocate_research_commit_rank() FROM PUBLIC;
  REVOKE ALL ON FUNCTION private.enforce_research_edge_registry() FROM PUBLIC;
  REVOKE ALL ON FUNCTION private.prevent_research_graph_mutation() FROM PUBLIC;
  REVOKE ALL ON FUNCTION private.protect_research_node_identity() FROM PUBLIC;
  REVOKE ALL ON FUNCTION private.validate_research_revision_lineage_edge() FROM PUBLIC;
  REVOKE ALL ON FUNCTION private.validate_typed_research_motif() FROM PUBLIC;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON
      public.research_graph_nodes, public.research_graph_edges,
      public.research_answers, public.research_rebuttals,
      public.research_evaluations, public.research_evaluation_bases,
      public.research_datasets, public.research_tools
    FROM anon;
    REVOKE USAGE ON SCHEMA private FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA private TO anon, authenticated;
    GRANT SELECT ON private.research_nodes, private.research_node_revisions, private.research_edges TO anon, authenticated;
    CREATE POLICY rg_nodes_public_read ON private.research_nodes
      FOR SELECT TO anon, authenticated
      USING (EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.project_id = research_nodes.project_id
          AND project.state = 'active'
          AND project.deleted_at IS NULL
      ));
    CREATE POLICY rg_nodes_member_read ON private.research_nodes
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM public.project_members AS membership
        JOIN public.identities AS identity ON identity.actor_id = membership.actor_id
        WHERE membership.project_id = research_nodes.project_id
          AND membership.deleted_at IS NULL
          AND identity.provider = 'supabase'
          AND identity.subject = (SELECT auth.uid())::text
          AND identity.deleted_at IS NULL
      ));
    CREATE POLICY rg_revisions_visible_read ON private.research_node_revisions
      FOR SELECT TO anon, authenticated
      USING (EXISTS (
        SELECT 1 FROM private.research_nodes AS node
        WHERE node.node_kind = research_node_revisions.node_kind
          AND node.node_id = research_node_revisions.node_id
      ));
    CREATE POLICY rg_edges_visible_read ON private.research_edges
      FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM private.research_node_revisions AS source_revision
          WHERE source_revision.node_kind = research_edges.source_kind
            AND source_revision.node_id = research_edges.source_id
            AND source_revision.revision = research_edges.source_revision
        )
        AND EXISTS (
          SELECT 1 FROM private.research_node_revisions AS target_revision
          WHERE target_revision.node_kind = research_edges.target_kind
            AND target_revision.node_id = research_edges.target_id
            AND target_revision.revision = research_edges.target_revision
        )
      );
    CREATE POLICY rg_answer_revisions_visible_read ON private.answer_revisions
      FOR SELECT TO anon, authenticated
      USING (EXISTS (
        SELECT 1 FROM private.research_node_revisions AS revision
        WHERE revision.node_kind = answer_revisions.node_kind
          AND revision.node_id = answer_revisions.answer_id
          AND revision.revision = answer_revisions.revision
      ));
    CREATE POLICY rg_rebuttal_revisions_visible_read ON private.rebuttal_revisions
      FOR SELECT TO anon, authenticated
      USING (EXISTS (
        SELECT 1 FROM private.research_node_revisions AS revision
        WHERE revision.node_kind = rebuttal_revisions.node_kind
          AND revision.node_id = rebuttal_revisions.rebuttal_id
          AND revision.revision = rebuttal_revisions.revision
      ));
    CREATE POLICY rg_evaluation_revisions_visible_read ON private.evaluation_revisions
      FOR SELECT TO anon, authenticated
      USING (EXISTS (
        SELECT 1 FROM private.research_node_revisions AS revision
        WHERE revision.node_kind = evaluation_revisions.node_kind
          AND revision.node_id = evaluation_revisions.evaluation_id
          AND revision.revision = evaluation_revisions.revision
      ));
    CREATE POLICY rg_evaluation_bases_visible_read ON private.evaluation_bases
      FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM private.research_node_revisions AS evaluation_revision
          WHERE evaluation_revision.node_kind = 'evaluation'
            AND evaluation_revision.node_id = evaluation_bases.evaluation_id
            AND evaluation_revision.revision = evaluation_bases.evaluation_revision
        )
        AND EXISTS (
          SELECT 1 FROM private.research_node_revisions AS basis_revision
          WHERE basis_revision.node_kind = evaluation_bases.basis_kind
            AND basis_revision.node_id = evaluation_bases.basis_id
            AND basis_revision.revision = evaluation_bases.basis_revision
        )
      );
    CREATE POLICY rg_dataset_revisions_visible_read ON private.dataset_revisions
      FOR SELECT TO anon, authenticated
      USING (EXISTS (
        SELECT 1 FROM private.research_node_revisions AS revision
        WHERE revision.node_kind = dataset_revisions.node_kind
          AND revision.node_id = dataset_revisions.dataset_id
          AND revision.revision = dataset_revisions.revision
      ));
    CREATE POLICY rg_tool_revisions_visible_read ON private.tool_revisions
      FOR SELECT TO anon, authenticated
      USING (EXISTS (
        SELECT 1 FROM private.research_node_revisions AS revision
        WHERE revision.node_kind = tool_revisions.node_kind
          AND revision.node_id = tool_revisions.tool_id
          AND revision.revision = tool_revisions.revision
      ));
    GRANT SELECT ON
      private.answer_revisions, private.rebuttal_revisions,
      private.evaluation_revisions, private.evaluation_bases,
      private.dataset_revisions, private.tool_revisions
    TO anon, authenticated;
    GRANT SELECT ON
      public.research_graph_nodes, public.research_graph_edges,
      public.research_answers, public.research_rebuttals,
      public.research_evaluations, public.research_evaluation_bases,
      public.research_datasets, public.research_tools
    TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA private TO service_role;
    FOREACH table_name IN ARRAY all_tables LOOP
      EXECUTE format('GRANT SELECT, INSERT ON TABLE private.%I TO service_role', table_name);
      EXECUTE format('CREATE POLICY %I ON private.%I FOR SELECT TO service_role USING (true)', 'rg_read_' || table_name || '_svc', table_name);
      EXECUTE format('CREATE POLICY %I ON private.%I FOR INSERT TO service_role WITH CHECK (true)', 'rg_insert_' || table_name || '_svc', table_name);
    END LOOP;
    GRANT UPDATE (retired_at) ON private.research_nodes TO service_role;
    GRANT UPDATE (status, resolved_at, resolved_by) ON private.research_graph_migration_findings TO service_role;
    CREATE POLICY research_nodes_retire_service ON private.research_nodes FOR UPDATE TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY research_graph_findings_resolve_service ON private.research_graph_migration_findings FOR UPDATE TO service_role USING (true) WITH CHECK (true);
    GRANT USAGE, SELECT ON SEQUENCE private.research_commit_rank_seq TO service_role;
    GRANT EXECUTE ON FUNCTION private.allocate_research_commit_rank() TO service_role;
    GRANT SELECT ON
      public.research_graph_nodes, public.research_graph_edges,
      public.research_answers, public.research_rebuttals,
      public.research_evaluations, public.research_evaluation_bases,
      public.research_datasets, public.research_tools
    TO service_role;
  END IF;
END
$security$;
