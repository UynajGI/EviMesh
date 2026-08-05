CREATE TYPE "public"."attempt_state" AS ENUM('active', 'paused', 'submitted', 'abandoned');--> statement-breakpoint
CREATE TABLE "attempts" (
	"attempt_id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"state" "attempt_state" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_task_id_tasks_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;