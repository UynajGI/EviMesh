CREATE TYPE "public"."challenge_state" AS ENUM('open', 'admissible', 'investigating', 'upheld', 'rejected', 'resolved');--> statement-breakpoint
CREATE TABLE "challenge_revisions" (
	"challenge_id" text NOT NULL,
	"revision" integer NOT NULL,
	"state" "challenge_state" NOT NULL,
	"target_claim_id" text NOT NULL,
	"target_claim_revision" integer NOT NULL,
	"reason" text NOT NULL,
	"impact" jsonb NOT NULL,
	"proposed_resolution" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_revisions_pkey" PRIMARY KEY("challenge_id","revision"),
	CONSTRAINT "challenge_revisions_revision_positive" CHECK ("challenge_revisions"."revision" > 0),
	CONSTRAINT "challenge_revisions_target_revision_positive" CHECK ("challenge_revisions"."target_claim_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "challenge_revisions" ADD CONSTRAINT "challenge_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_revisions" ADD CONSTRAINT "challenge_revisions_challenge_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("challenge_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_revisions" ADD CONSTRAINT "challenge_revisions_target_claim_revision_fk" FOREIGN KEY ("target_claim_id","target_claim_revision") REFERENCES "public"."claim_revisions"("claim_id","revision") ON DELETE restrict ON UPDATE no action;