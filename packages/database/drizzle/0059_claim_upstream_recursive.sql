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
    WHERE upstream.depth < p_max_depth
      AND NOT relation.target_claim_id = ANY(upstream.path)
  )
  SELECT upstream.claim_id, MIN(upstream.depth), MIN(upstream.path)
  FROM upstream
  GROUP BY upstream.claim_id;
$$;
