CREATE TABLE "policy_evaluations" (
  "evaluation_id" text PRIMARY KEY NOT NULL,
  "claim_id" text NOT NULL REFERENCES "claims"("claim_id") ON DELETE restrict,
  "policy_id" text NOT NULL,
  "policy_revision" integer NOT NULL,
  "input_summary" jsonb NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "policy_evaluations_policy_revision_fk" FOREIGN KEY ("policy_id", "policy_revision") REFERENCES "verification_policy_revisions"("policy_id", "revision") ON DELETE restrict
);
