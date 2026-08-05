CREATE TYPE "public"."evidence_claim_relation" AS ENUM('supports', 'refutes', 'qualifies', 'reproduces');--> statement-breakpoint
CREATE TABLE "evidence_claim_links" (
	"evidence_id" text NOT NULL,
	"claim_id" text NOT NULL,
	"claim_revision" integer NOT NULL,
	"relation_type" "evidence_claim_relation" NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_claim_links_pkey" PRIMARY KEY("evidence_id","claim_id","claim_revision","relation_type"),
	CONSTRAINT "evidence_claim_links_revision_positive" CHECK ("evidence_claim_links"."claim_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "evidence_claim_links" ADD CONSTRAINT "evidence_claim_links_evidence_id_evidence_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("evidence_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claim_links" ADD CONSTRAINT "evidence_claim_links_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claim_links" ADD CONSTRAINT "evidence_claim_links_claim_revision_fk" FOREIGN KEY ("claim_id","claim_revision") REFERENCES "public"."claim_revisions"("claim_id","revision") ON DELETE restrict ON UPDATE no action;