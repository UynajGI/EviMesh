CREATE TYPE "public"."contribution_role" AS ENUM('originator', 'contributor', 'reviewer', 'verifier', 'witness', 'maintainer');--> statement-breakpoint
CREATE TABLE "contribution_statements" (
	"statement_id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"role" "contribution_role" NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_statements_description_nonempty" CHECK ("contribution_statements"."description" <> '')
);
--> statement-breakpoint
ALTER TABLE "contribution_statements" ADD CONSTRAINT "contribution_statements_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;