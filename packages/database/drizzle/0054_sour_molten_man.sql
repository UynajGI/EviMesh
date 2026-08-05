CREATE TABLE "merkle_checkpoints" (
	"checkpoint_id" text PRIMARY KEY NOT NULL,
	"first_event_id" text NOT NULL,
	"last_event_id" text NOT NULL,
	"event_count" integer NOT NULL,
	"root_hash" text NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merkle_checkpoints_event_count_positive" CHECK ("merkle_checkpoints"."event_count" > 0),
	CONSTRAINT "merkle_checkpoints_root_hash_sha256" CHECK ("merkle_checkpoints"."root_hash" ~* '^sha256:[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "merkle_checkpoints" ADD CONSTRAINT "merkle_checkpoints_first_event_fk" FOREIGN KEY ("first_event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merkle_checkpoints" ADD CONSTRAINT "merkle_checkpoints_last_event_fk" FOREIGN KEY ("last_event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;