CREATE TABLE "runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"context_bundle_id" text NOT NULL,
	"source_code" text NOT NULL,
	"container" text NOT NULL,
	"command" text NOT NULL,
	"args" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"environment" jsonb NOT NULL,
	"hardware" jsonb NOT NULL,
	"random_seed" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"network_access" boolean NOT NULL,
	"exit_code" integer NOT NULL,
	"actor_id" text NOT NULL,
	"signature" text NOT NULL,
	CONSTRAINT "runs_time_ordered" CHECK ("runs"."ended_at" >= "runs"."started_at")
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_task_id_tasks_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;