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
    WHERE downstream.depth < p_max_depth
      AND NOT relation.source_claim_id = ANY(downstream.path)
  )
  SELECT downstream.claim_id, MIN(downstream.depth), MIN(downstream.path)
  FROM downstream
  GROUP BY downstream.claim_id;
$$;
