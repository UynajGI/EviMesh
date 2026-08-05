CREATE TABLE "verification_contract_revisions" (
	"contract_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes" integer,
	"requirements" jsonb NOT NULL,
	"verification_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_modes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_contract_revisions_pkey" PRIMARY KEY("contract_id","revision"),
	CONSTRAINT "verification_contract_revisions_revision_positive" CHECK ("verification_contract_revisions"."revision" > 0),
	CONSTRAINT "verification_contract_revisions_supersedes_previous" CHECK (("verification_contract_revisions"."revision" = 1 AND "verification_contract_revisions"."supersedes" IS NULL) OR ("verification_contract_revisions"."revision" > 1 AND "verification_contract_revisions"."supersedes" = "verification_contract_revisions"."revision" - 1))
);
--> statement-breakpoint
ALTER TABLE "verification_contract_revisions" ADD CONSTRAINT "verification_contract_revisions_contract_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."verification_contracts"("contract_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_contract_revisions" ADD CONSTRAINT "verification_contract_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;
