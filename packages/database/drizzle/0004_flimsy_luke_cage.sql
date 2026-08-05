CREATE TABLE "signing_keys" (
	"key_id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"algorithm" text DEFAULT 'Ed25519' NOT NULL,
	"public_key" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE cascade ON UPDATE no action;