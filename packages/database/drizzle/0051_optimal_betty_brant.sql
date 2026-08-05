CREATE TABLE "research_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"hash" text NOT NULL,
	"signature" jsonb NOT NULL,
	"parents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_events_event_id_uuidv7" CHECK ("research_events"."event_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
	CONSTRAINT "research_events_event_type_namespaced" CHECK ("research_events"."event_type" ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$'),
	CONSTRAINT "research_events_hash_sha256" CHECK ("research_events"."hash" ~* '^sha256:[0-9a-f]{64}$')
);
