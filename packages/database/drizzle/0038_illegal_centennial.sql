CREATE TABLE "verification_policy_revisions" (
	"policy_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes" integer,
	"requirements" jsonb NOT NULL,
	"outcomes" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_policy_revisions_pkey" PRIMARY KEY("policy_id","revision"),
	CONSTRAINT "verification_policy_revisions_revision_positive" CHECK ("verification_policy_revisions"."revision" > 0),
	CONSTRAINT "verification_policy_revisions_supersedes_previous" CHECK (("verification_policy_revisions"."revision" = 1 AND "verification_policy_revisions"."supersedes" IS NULL) OR ("verification_policy_revisions"."revision" > 1 AND "verification_policy_revisions"."supersedes" = "verification_policy_revisions"."revision" - 1))
);
--> statement-breakpoint
ALTER TABLE "verification_policy_revisions" ADD CONSTRAINT "verification_policy_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_policy_revisions" ADD CONSTRAINT "verification_policy_revisions_policy_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."verification_policies"("policy_id") ON DELETE restrict ON UPDATE no action;