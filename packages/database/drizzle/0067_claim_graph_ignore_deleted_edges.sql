CREATE OR REPLACE FUNCTION claim_upstream_dependencies(
  p_root_claim_id text,
  p_max_depth integer DEFAULT 100
)
RETURNS TABLE (
  claim_id text,
  depth integer,
  path text[]
)
LANGUAGE SQL
STABLE
AS $$
  WITH RECURSIVE upstream(claim_id, depth, path) AS (
    SELECT
      relation.target_claim_id,
      1,
      ARRAY[p_root_claim_id, relation.target_claim_id]::text[]
    FROM claim_relations AS relation
    WHERE relation.source_claim_id = p_root_claim_id
      AND relation.relation_type = 'depends_on'
      AND relation.deleted_at IS NULL
      AND p_max_depth > 0

    UNION ALL

    SELECT
      relation.target_claim_id,
      upstream.depth + 1,
      upstream.path || relation.target_claim_id
    FROM upstream
    JOIN claim_relations AS relation
      ON relation.source_claim_id = upstream.claim_id
     AND relation.relation_type = 'depends_on'
     AND relation.deleted_at IS NULL
    WHERE upstream.depth < p_max_depth
      AND NOT relation.target_claim_id = ANY(upstream.path)
  )
  SELECT upstream.claim_id, MIN(upstream.depth), MIN(upstream.path)
  FROM upstream
  GROUP BY upstream.claim_id;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION claim_downstream_dependents(
  p_root_claim_id text,
  p_max_depth integer DEFAULT 100
)
RETURNS TABLE (
  claim_id text,
  depth integer,
  path text[]
)
LANGUAGE SQL
STABLE
AS $$
  WITH RECURSIVE downstream(claim_id, depth, path) AS (
    SELECT
      relation.source_claim_id,
      1,
      ARRAY[p_root_claim_id, relation.source_claim_id]::text[]
    FROM claim_relations AS relation
    WHERE relation.target_claim_id = p_root_claim_id
      AND relation.relation_type = 'depends_on'
      AND relation.deleted_at IS NULL
      AND p_max_depth > 0

    UNION ALL

    SELECT
      relation.source_claim_id,
      downstream.depth + 1,
      downstream.path || relation.source_claim_id
    FROM downstream
    JOIN claim_relations AS relation
      ON relation.target_claim_id = downstream.claim_id
     AND relation.relation_type = 'depends_on'
     AND relation.deleted_at IS NULL
    WHERE downstream.depth < p_max_depth
      AND NOT relation.source_claim_id = ANY(downstream.path)
  )
  SELECT downstream.claim_id, MIN(downstream.depth), MIN(downstream.path)
  FROM downstream
  GROUP BY downstream.claim_id;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION assert_claim_dependency_acyclic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cycle_found boolean;
BEGIN
  IF NEW.relation_type = 'depends_on' AND NEW.deleted_at IS NULL THEN
    WITH RECURSIVE reachable(claim_id) AS (
      SELECT NEW.target_claim_id

      UNION

      SELECT relation.target_claim_id
      FROM claim_relations AS relation
      JOIN reachable
        ON reachable.claim_id = relation.source_claim_id
      WHERE relation.relation_type = 'depends_on'
        AND relation.deleted_at IS NULL
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
