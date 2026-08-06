CREATE OR REPLACE FUNCTION prevent_published_frontier_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM research_events
    WHERE event_type = 'frontier.published'
      AND payload ->> 'entity_type' = 'frontier_snapshot'
      AND payload ->> 'snapshot_id' = OLD.snapshot_id
  ) THEN
    RAISE EXCEPTION 'published frontier snapshots are immutable; % is not allowed', TG_OP
      USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER published_frontier_snapshots_immutable_trigger
BEFORE UPDATE OR DELETE ON frontier_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_published_frontier_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_published_frontier_member_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM research_events
    WHERE event_type = 'frontier.published'
      AND payload ->> 'entity_type' = 'frontier_snapshot'
      AND payload ->> 'snapshot_id' = COALESCE(NEW.snapshot_id, OLD.snapshot_id)
  ) THEN
    RAISE EXCEPTION 'published frontier members are immutable; % is not allowed', TG_OP
      USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER published_frontier_members_immutable_trigger
BEFORE INSERT OR UPDATE OR DELETE ON frontier_members
FOR EACH ROW
EXECUTE FUNCTION prevent_published_frontier_member_mutation();
