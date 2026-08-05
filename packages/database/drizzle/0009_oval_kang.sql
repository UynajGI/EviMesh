CREATE TYPE "public"."project_state" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "projects" (
	"project_id" text PRIMARY KEY NOT NULL,
	"state" "project_state" DEFAULT 'draft' NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"created_by" text NOT NULL,
	"license" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;