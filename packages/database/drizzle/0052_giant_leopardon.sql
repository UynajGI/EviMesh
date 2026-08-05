CREATE TABLE "research_event_parents" (
	"event_id" text NOT NULL,
	"parent_event_id" text NOT NULL,
	CONSTRAINT "research_event_parents_pkey" PRIMARY KEY("event_id","parent_event_id"),
	CONSTRAINT "research_event_parents_no_self_loop" CHECK ("research_event_parents"."event_id" <> "research_event_parents"."parent_event_id")
);
--> statement-breakpoint
ALTER TABLE "research_event_parents" ADD CONSTRAINT "research_event_parents_event_fk" FOREIGN KEY ("event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_event_parents" ADD CONSTRAINT "research_event_parents_parent_fk" FOREIGN KEY ("parent_event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;