CREATE TABLE "claim_revisions" (
	"claim_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes" integer,
	"state" "claim_state" NOT NULL,
	"statement" text NOT NULL,
	"scope" jsonb NOT NULL,
	"assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"falsification" jsonb NOT NULL,
	"question_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_revisions_pkey" PRIMARY KEY("claim_id","revision"),
	CONSTRAINT "claim_revisions_revision_positive" CHECK ("claim_revisions"."revision" > 0),
	CONSTRAINT "claim_revisions_supersedes_previous" CHECK (("claim_revisions"."revision" = 1 AND "claim_revisions"."supersedes" IS NULL) OR ("claim_revisions"."revision" > 1 AND "claim_revisions"."supersedes" = "claim_revisions"."revision" - 1))
);
--> statement-breakpoint
ALTER TABLE "claim_revisions" ADD CONSTRAINT "claim_revisions_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_revisions" ADD CONSTRAINT "claim_revisions_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_revisions" ADD CONSTRAINT "claim_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;