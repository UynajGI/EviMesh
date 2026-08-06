DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "contribution_statements") THEN
    RAISE EXCEPTION 'contribution statements require an explicit Event backfill before migration 0069'
      USING ERRCODE = '55000';
  END IF;
END;
$$;
--> statement-breakpoint
ALTER TABLE "contribution_statements" ADD COLUMN "event_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "contribution_statements" ADD CONSTRAINT "contribution_statements_event_id_research_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;
