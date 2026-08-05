CREATE TYPE "public"."context_mode" AS ENUM('frontier', 'full_trace', 'adversarial', 'blind');--> statement-breakpoint
CREATE TABLE "task_revisions" (
	"task_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes" integer,
	"state" "task_state" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outputs" jsonb NOT NULL,
	"acceptance" jsonb NOT NULL,
	"context_mode" "context_mode" NOT NULL,
	"question_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_revisions_pkey" PRIMARY KEY("task_id","revision"),
	CONSTRAINT "task_revisions_revision_positive" CHECK ("task_revisions"."revision" > 0),
	CONSTRAINT "task_revisions_supersedes_previous" CHECK (("task_revisions"."revision" = 1 AND "task_revisions"."supersedes" IS NULL) OR ("task_revisions"."revision" > 1 AND "task_revisions"."supersedes" = "task_revisions"."revision" - 1))
);
--> statement-breakpoint
ALTER TABLE "task_revisions" ADD CONSTRAINT "task_revisions_task_id_tasks_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_revisions" ADD CONSTRAINT "task_revisions_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_revisions" ADD CONSTRAINT "task_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;