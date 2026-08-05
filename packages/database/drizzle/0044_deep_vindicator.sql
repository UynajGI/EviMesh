CREATE TABLE "merge_proposals" (
	"proposal_id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"claim_revision" integer NOT NULL,
	"policy_id" text NOT NULL,
	"policy_revision" integer NOT NULL,
	"status" text NOT NULL,
	"evaluation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "merge_proposals_claim_revision_positive" CHECK ("merge_proposals"."claim_revision" > 0),
	CONSTRAINT "merge_proposals_policy_revision_positive" CHECK ("merge_proposals"."policy_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "merge_proposals" ADD CONSTRAINT "merge_proposals_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_proposals" ADD CONSTRAINT "merge_proposals_claim_revision_fk" FOREIGN KEY ("claim_id","claim_revision") REFERENCES "public"."claim_revisions"("claim_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_proposals" ADD CONSTRAINT "merge_proposals_policy_revision_fk" FOREIGN KEY ("policy_id","policy_revision") REFERENCES "public"."verification_policy_revisions"("policy_id","revision") ON DELETE restrict ON UPDATE no action;