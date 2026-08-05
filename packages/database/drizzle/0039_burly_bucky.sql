CREATE TYPE "public"."verification_outcome" AS ENUM('supports', 'refutes', 'qualifies', 'inconclusive');--> statement-breakpoint
CREATE TABLE "verification_receipts" (
	"receipt_id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"claim_revision" integer NOT NULL,
	"contract_id" text NOT NULL,
	"contract_revision" integer NOT NULL,
	"outcome" "verification_outcome" NOT NULL,
	"verification_types" jsonb NOT NULL,
	"context_mode" text NOT NULL,
	"saw_expected_outputs" boolean NOT NULL,
	"implementation_relation" text NOT NULL,
	"data_relation" text NOT NULL,
	"model_family" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_receipts" ADD CONSTRAINT "verification_receipts_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_receipts" ADD CONSTRAINT "verification_receipts_claim_revision_fk" FOREIGN KEY ("claim_id","claim_revision") REFERENCES "public"."claim_revisions"("claim_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_receipts" ADD CONSTRAINT "verification_receipts_contract_revision_fk" FOREIGN KEY ("contract_id","contract_revision") REFERENCES "public"."verification_contract_revisions"("contract_id","revision") ON DELETE restrict ON UPDATE no action;