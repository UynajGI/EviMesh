CREATE TYPE "public"."claim_relation_type" AS ENUM('depends_on', 'supports', 'refutes', 'qualifies', 'reproduces', 'extends', 'supersedes', 'contradicts', 'derived_from', 'uses_method', 'uses_dataset', 'implements', 'verifies', 'challenges');--> statement-breakpoint
CREATE TABLE "claim_relations" (
	"source_claim_id" text NOT NULL,
	"target_claim_id" text NOT NULL,
	"relation_type" "claim_relation_type" NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "claim_relations_pkey" PRIMARY KEY("source_claim_id","target_claim_id","relation_type")
);
--> statement-breakpoint
ALTER TABLE "claim_relations" ADD CONSTRAINT "claim_relations_source_claim_id_claims_claim_id_fk" FOREIGN KEY ("source_claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_relations" ADD CONSTRAINT "claim_relations_target_claim_id_claims_claim_id_fk" FOREIGN KEY ("target_claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_relations" ADD CONSTRAINT "claim_relations_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;