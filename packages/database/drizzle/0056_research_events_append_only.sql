CREATE OR REPLACE FUNCTION prevent_research_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'research_events are append-only; % is not allowed', TG_OP
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER research_events_append_only_trigger
BEFORE UPDATE OR DELETE ON research_events
FOR EACH ROW
EXECUTE FUNCTION prevent_research_event_mutation();
