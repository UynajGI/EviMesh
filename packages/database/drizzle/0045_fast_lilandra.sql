CREATE TABLE "frontier_snapshots" (
	"snapshot_id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"previous_sequence" integer,
	"project_revision" integer NOT NULL,
	"checkpoint" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frontier_snapshots_sequence_positive" CHECK ("frontier_snapshots"."sequence" > 0),
	CONSTRAINT "frontier_snapshots_project_revision_positive" CHECK ("frontier_snapshots"."project_revision" > 0),
	CONSTRAINT "frontier_snapshots_previous_contiguous" CHECK (("frontier_snapshots"."sequence" = 1 AND "frontier_snapshots"."previous_sequence" IS NULL) OR ("frontier_snapshots"."sequence" > 1 AND "frontier_snapshots"."previous_sequence" = "frontier_snapshots"."sequence" - 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "frontier_snapshots_project_sequence_idx" ON "frontier_snapshots" USING btree ("project_id","sequence");
--> statement-breakpoint
ALTER TABLE "frontier_snapshots" ADD CONSTRAINT "frontier_snapshots_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frontier_snapshots" ADD CONSTRAINT "frontier_snapshots_project_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frontier_snapshots" ADD CONSTRAINT "frontier_snapshots_project_revision_fk" FOREIGN KEY ("project_id","project_revision") REFERENCES "public"."project_revisions"("project_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frontier_snapshots" ADD CONSTRAINT "frontier_snapshots_previous_fk" FOREIGN KEY ("project_id","previous_sequence") REFERENCES "public"."frontier_snapshots"("project_id","sequence") ON DELETE restrict ON UPDATE no action;
