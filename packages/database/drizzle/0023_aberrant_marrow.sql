CREATE TYPE "public"."claim_state" AS ENUM('hypothesis', 'candidate', 'under_verification', 'provisionally_accepted', 'accepted', 'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted');--> statement-breakpoint
CREATE TABLE "claims" (
	"claim_id" text PRIMARY KEY NOT NULL,
	"question_id" text,
	"state" "claim_state" DEFAULT 'hypothesis' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;