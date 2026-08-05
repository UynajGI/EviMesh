CREATE TYPE "public"."event_outbox_status" AS ENUM('pending', 'processing', 'processed', 'dead_letter');--> statement-breakpoint
CREATE TABLE "event_outbox" (
	"outbox_id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"status" "event_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_outbox_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "event_outbox_attempts_nonnegative" CHECK ("event_outbox"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "event_outbox" ADD CONSTRAINT "event_outbox_event_fk" FOREIGN KEY ("event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_outbox_claim_idx" ON "event_outbox" USING btree ("status","available_at");