CREATE TABLE "context_bundles" (
	"context_bundle_id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"task_revision" integer NOT NULL,
	"frontier_snapshot_id" text,
	"mode" "context_mode" NOT NULL,
	"manifest" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"storage_uri" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "context_bundles_task_revision_positive" CHECK ("context_bundles"."task_revision" > 0),
	CONSTRAINT "context_bundles_content_hash_nonempty" CHECK ("context_bundles"."content_hash" <> ''),
	CONSTRAINT "context_bundles_storage_uri_nonempty" CHECK ("context_bundles"."storage_uri" <> '')
);
--> statement-breakpoint
ALTER TABLE "context_bundles" ADD CONSTRAINT "context_bundles_task_revision_fk" FOREIGN KEY ("task_id","task_revision") REFERENCES "public"."task_revisions"("task_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_bundles" ADD CONSTRAINT "context_bundles_frontier_snapshot_fk" FOREIGN KEY ("frontier_snapshot_id") REFERENCES "public"."frontier_snapshots"("snapshot_id") ON DELETE restrict ON UPDATE no action;