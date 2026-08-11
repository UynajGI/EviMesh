ALTER TABLE "task_revisions" ADD COLUMN "task_type" text DEFAULT 'general' NOT NULL;
--> statement-breakpoint
ALTER TABLE "task_revisions" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;
