CREATE TABLE "artifact_locations" (
	"location_id" text PRIMARY KEY NOT NULL,
	"artifact_id" text NOT NULL,
	"location_type" text NOT NULL,
	"uri" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_locations_artifact_uri_unique" UNIQUE("artifact_id","uri"),
	CONSTRAINT "artifact_locations_uri_format" CHECK ("artifact_locations"."uri" ~ '^[a-z][a-z0-9+.-]*://[^\s]+$')
);
--> statement-breakpoint
ALTER TABLE "artifact_locations" ADD CONSTRAINT "artifact_locations_artifact_id_artifacts_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("artifact_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_locations" ADD CONSTRAINT "artifact_locations_created_by_actors_actor_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;