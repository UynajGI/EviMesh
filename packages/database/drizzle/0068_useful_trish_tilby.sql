ALTER TABLE "artifact_locations" ADD COLUMN "raw_hash" text;--> statement-breakpoint
ALTER TABLE "artifact_locations" ADD COLUMN "size_bytes" bigint;--> statement-breakpoint
ALTER TABLE "artifact_locations" ADD COLUMN "license" text;--> statement-breakpoint
ALTER TABLE "artifact_locations" ADD CONSTRAINT "artifact_locations_external_metadata" CHECK ("artifact_locations"."location_type" <> 'external' OR ("artifact_locations"."raw_hash" ~ '^sha256:[0-9a-f]{64}$' AND "artifact_locations"."size_bytes" >= 0 AND length(trim("artifact_locations"."license")) > 0));