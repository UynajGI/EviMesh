CREATE TYPE "public"."task_dependency_type" AS ENUM('depends_on');--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"source_task_id" text NOT NULL,
	"target_task_id" text NOT NULL,
	"dependency_type" "task_dependency_type" DEFAULT 'depends_on' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "task_dependencies_pkey" PRIMARY KEY("source_task_id","target_task_id"),
	CONSTRAINT "task_dependencies_no_self_reference" CHECK ("task_dependencies"."source_task_id" <> "task_dependencies"."target_task_id")
);
--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_source_task_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("task_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_target_task_fk" FOREIGN KEY ("target_task_id") REFERENCES "public"."tasks"("task_id") ON DELETE no action ON UPDATE no action;