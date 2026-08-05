CREATE TYPE "public"."evidence_type" AS ENUM('formal_proof', 'numerical_result', 'experimental_result', 'dataset', 'literature_support', 'counterexample', 'benchmark', 'statistical_analysis', 'code_test', 'negative_result', 'expert_assessment');--> statement-breakpoint
CREATE TABLE "evidence" (
	"evidence_id" text PRIMARY KEY NOT NULL,
	"evidence_type" "evidence_type" NOT NULL,
	"artifact_id" text NOT NULL,
	"artifact_revision" integer NOT NULL,
	"run_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_artifact_revision_positive" CHECK ("evidence"."artifact_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_run_id_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_artifact_revision_fk" FOREIGN KEY ("artifact_id","artifact_revision") REFERENCES "public"."artifact_revisions"("artifact_id","revision") ON DELETE restrict ON UPDATE no action;