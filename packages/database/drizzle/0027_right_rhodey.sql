CREATE TYPE "public"."artifact_type" AS ENUM('code', 'dataset', 'document', 'figure', 'proof', 'notebook', 'container', 'model', 'report', 'other');--> statement-breakpoint
CREATE TABLE "artifact_revisions" (
	"artifact_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes" integer,
	"artifact_type" "artifact_type" NOT NULL,
	"raw_hash" text NOT NULL,
	"semantic_hash" text,
	"size_bytes" bigint NOT NULL,
	"media_type" text NOT NULL,
	"license" text NOT NULL,
	"description" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_revisions_pkey" PRIMARY KEY("artifact_id","revision"),
	CONSTRAINT "artifact_revisions_revision_positive" CHECK ("artifact_revisions"."revision" > 0),
	CONSTRAINT "artifact_revisions_supersedes_previous" CHECK (("artifact_revisions"."revision" = 1 AND "artifact_revisions"."supersedes" IS NULL) OR ("artifact_revisions"."revision" > 1 AND "artifact_revisions"."supersedes" = "artifact_revisions"."revision" - 1)),
	CONSTRAINT "artifact_revisions_raw_hash_format" CHECK ("artifact_revisions"."raw_hash" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "artifact_revisions_semantic_hash_format" CHECK ("artifact_revisions"."semantic_hash" IS NULL OR "artifact_revisions"."semantic_hash" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "artifact_revisions_size_nonnegative" CHECK ("artifact_revisions"."size_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "artifact_revisions" ADD CONSTRAINT "artifact_revisions_artifact_id_artifacts_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("artifact_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_revisions" ADD CONSTRAINT "artifact_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;