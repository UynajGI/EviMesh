CREATE OR REPLACE FUNCTION assert_claim_dependency_acyclic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cycle_found boolean;
BEGIN
  IF NEW.relation_type = 'depends_on' THEN
    WITH RECURSIVE reachable(claim_id) AS (
      SELECT NEW.target_claim_id

      UNION

      SELECT relation.target_claim_id
      FROM claim_relations AS relation
      JOIN reachable
        ON reachable.claim_id = relation.source_claim_id
      WHERE relation.relation_type = 'depends_on'
    )
    SELECT EXISTS (
      SELECT 1
      FROM reachable
      WHERE reachable.claim_id = NEW.source_claim_id
    )
    INTO cycle_found;

    IF cycle_found THEN
      RAISE EXCEPTION 'depends_on cycle detected: % -> %',
        NEW.source_claim_id, NEW.target_claim_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER claim_relations_dependency_acyclic_trigger
BEFORE INSERT OR UPDATE OF source_claim_id, target_claim_id, relation_type
ON claim_relations
FOR EACH ROW
EXECUTE FUNCTION assert_claim_dependency_acyclic();
