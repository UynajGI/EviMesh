CREATE TABLE "project_revisions" (
	"project_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes" integer,
	"state" "project_state" NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"created_by" text NOT NULL,
	"maintainer_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"license" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_revisions_pkey" PRIMARY KEY("project_id","revision"),
	CONSTRAINT "project_revisions_revision_positive" CHECK ("project_revisions"."revision" > 0),
	CONSTRAINT "project_revisions_supersedes_previous" CHECK (("project_revisions"."revision" = 1 AND "project_revisions"."supersedes" IS NULL) OR ("project_revisions"."revision" > 1 AND "project_revisions"."supersedes" = "project_revisions"."revision" - 1))
);
--> statement-breakpoint
ALTER TABLE "project_revisions" ADD CONSTRAINT "project_revisions_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_revisions" ADD CONSTRAINT "project_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;