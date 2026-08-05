CREATE TABLE "notifications" (
	"notification_id" text PRIMARY KEY NOT NULL,
	"recipient_actor_id" text NOT NULL,
	"event_id" text NOT NULL,
	"notification_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_recipient_event_type_unique" UNIQUE("recipient_actor_id","event_id","notification_type"),
	CONSTRAINT "notifications_type_namespaced" CHECK ("notifications"."notification_type" ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$')
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_actor_fk" FOREIGN KEY ("recipient_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_fk" FOREIGN KEY ("event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "notifications" USING btree ("recipient_actor_id","read_at","created_at");