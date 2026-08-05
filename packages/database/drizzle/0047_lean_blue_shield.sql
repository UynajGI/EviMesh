CREATE TABLE "frontier_members" (
	"snapshot_id" text NOT NULL,
	"claim_id" text NOT NULL,
	"claim_revision" integer NOT NULL,
	"membership_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frontier_members_pkey" PRIMARY KEY("snapshot_id","claim_id","claim_revision"),
	CONSTRAINT "frontier_members_claim_revision_positive" CHECK ("frontier_members"."claim_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "frontier_members" ADD CONSTRAINT "frontier_members_snapshot_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."frontier_snapshots"("snapshot_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frontier_members" ADD CONSTRAINT "frontier_members_claim_revision_fk" FOREIGN KEY ("claim_id","claim_revision") REFERENCES "public"."claim_revisions"("claim_id","revision") ON DELETE restrict ON UPDATE no action;