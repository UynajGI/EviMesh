CREATE TABLE "trace_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"hash" text NOT NULL,
	"signature" jsonb NOT NULL,
	"parents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trace_events_event_type_namespaced" CHECK ("trace_events"."event_type" ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'),
	CONSTRAINT "trace_events_hash_sha256" CHECK ("trace_events"."hash" ~* '^sha256:[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "trace_events" ADD CONSTRAINT "trace_events_attempt_id_attempts_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("attempt_id") ON DELETE restrict ON UPDATE no action;