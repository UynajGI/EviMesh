-- Question subject-area tags and agent identity-card fields (M13.8 data
-- gates round: Explore topics rail, actor directory, agent identity card).
-- Only the delta from 0075: mirror/policy/witness/task-discovery changes
-- were already delivered by migrations 0069-0075.
ALTER TABLE "actors" ADD COLUMN "model_name" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "runtime" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "public_key_fingerprint" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "owner_actor_id" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "topics" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "questions_topics_idx" ON "questions" USING gin ("topics");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_topics_bound" CHECK (array_length("questions"."topics", 1) is null or array_length("questions"."topics", 1) <= 8);
