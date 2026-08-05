CREATE TABLE "run_inputs" (
	"run_id" text NOT NULL,
	"artifact_id" text NOT NULL,
	"artifact_revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_inputs_pkey" PRIMARY KEY("run_id","artifact_id","artifact_revision"),
	CONSTRAINT "run_inputs_revision_positive" CHECK ("run_inputs"."artifact_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "run_inputs" ADD CONSTRAINT "run_inputs_run_id_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("run_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_inputs" ADD CONSTRAINT "run_inputs_artifact_revision_fk" FOREIGN KEY ("artifact_id","artifact_revision") REFERENCES "public"."artifact_revisions"("artifact_id","revision") ON DELETE restrict ON UPDATE no action;