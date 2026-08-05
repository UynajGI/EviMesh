CREATE TABLE "question_revisions" (
	"question_id" text NOT NULL,
	"revision" integer NOT NULL,
	"supersedes" integer,
	"state" "question_state" NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"research_contract" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_revisions_pkey" PRIMARY KEY("question_id","revision"),
	CONSTRAINT "question_revisions_revision_positive" CHECK ("question_revisions"."revision" > 0),
	CONSTRAINT "question_revisions_supersedes_previous" CHECK (("question_revisions"."revision" = 1 AND "question_revisions"."supersedes" IS NULL) OR ("question_revisions"."revision" > 1 AND "question_revisions"."supersedes" = "question_revisions"."revision" - 1))
);
--> statement-breakpoint
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;