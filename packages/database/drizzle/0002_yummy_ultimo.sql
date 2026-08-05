CREATE TABLE "actor_profiles" (
	"actor_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"bio" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE cascade ON UPDATE no action;