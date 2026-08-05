CREATE TABLE "challenge_impacts" (
	"impact_id" text PRIMARY KEY NOT NULL,
	"challenge_id" text NOT NULL,
	"challenge_revision" integer NOT NULL,
	"claim_id" text NOT NULL,
	"claim_revision" integer NOT NULL,
	"impact_type" text NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_impacts_challenge_revision_positive" CHECK ("challenge_impacts"."challenge_revision" > 0),
	CONSTRAINT "challenge_impacts_claim_revision_positive" CHECK ("challenge_impacts"."claim_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "challenge_impacts" ADD CONSTRAINT "challenge_impacts_challenge_revision_fk" FOREIGN KEY ("challenge_id","challenge_revision") REFERENCES "public"."challenge_revisions"("challenge_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_impacts" ADD CONSTRAINT "challenge_impacts_claim_revision_fk" FOREIGN KEY ("claim_id","claim_revision") REFERENCES "public"."claim_revisions"("claim_id","revision") ON DELETE restrict ON UPDATE no action;