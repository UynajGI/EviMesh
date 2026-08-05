CREATE TYPE "public"."actor_type" AS ENUM('human', 'agent', 'organization', 'service', 'maintainer', 'witness');--> statement-breakpoint
CREATE TYPE "public"."identity_strength" AS ENUM('verified', 'observed', 'self_declared', 'unknown');--> statement-breakpoint
CREATE TABLE "actors" (
	"actor_id" text PRIMARY KEY NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"identity_strength" "identity_strength" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
