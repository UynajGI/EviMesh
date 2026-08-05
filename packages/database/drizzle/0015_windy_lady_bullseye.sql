CREATE TYPE "public"."contract_risk_level" AS ENUM('open', 'moderated', 'restricted', 'prohibited');--> statement-breakpoint
CREATE TABLE "research_contract_revisions" (
	"contract_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes" integer,
	"problem" text NOT NULL,
	"definitions" jsonb NOT NULL,
	"background" text NOT NULL,
	"scope" jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"progress_criteria" jsonb NOT NULL,
	"acceptable_evidence" jsonb NOT NULL,
	"falsification" jsonb NOT NULL,
	"license" text NOT NULL,
	"risk_level" "contract_risk_level" NOT NULL,
	"maintainer_ids" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_contract_revisions_pkey" PRIMARY KEY("contract_id","revision"),
	CONSTRAINT "research_contract_revisions_revision_positive" CHECK ("research_contract_revisions"."revision" > 0),
	CONSTRAINT "research_contract_revisions_supersedes_previous" CHECK (("research_contract_revisions"."revision" = 1 AND "research_contract_revisions"."supersedes" IS NULL) OR ("research_contract_revisions"."revision" > 1 AND "research_contract_revisions"."supersedes" = "research_contract_revisions"."revision" - 1))
);
--> statement-breakpoint
ALTER TABLE "research_contract_revisions" ADD CONSTRAINT "research_contract_revisions_contract_id_research_contracts_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."research_contracts"("contract_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_contract_revisions" ADD CONSTRAINT "research_contract_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;