-- Public research Graph projections are read-only for authenticated browser
-- sessions. Revoke every direct privilege first so an earlier broad grant
-- cannot survive this migration, then restore SELECT only.
DO $graph_view_authenticated_read_only$
DECLARE
  view_name text;
  view_names constant text[] := ARRAY[
    'research_graph_nodes',
    'research_graph_edges',
    'research_answers',
    'research_rebuttals',
    'research_evaluations',
    'research_evaluation_bases',
    'research_datasets',
    'research_tools'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RETURN;
  END IF;

  REVOKE ALL ON TABLE
    public.research_graph_nodes,
    public.research_graph_edges,
    public.research_answers,
    public.research_rebuttals,
    public.research_evaluations,
    public.research_evaluation_bases,
    public.research_datasets,
    public.research_tools
  FROM authenticated;

  GRANT SELECT ON TABLE
    public.research_graph_nodes,
    public.research_graph_edges,
    public.research_answers,
    public.research_rebuttals,
    public.research_evaluations,
    public.research_evaluation_bases,
    public.research_datasets,
    public.research_tools
  TO authenticated;

  FOREACH view_name IN ARRAY view_names LOOP
    IF NOT has_table_privilege(
      'authenticated',
      format('%I.%I', 'public', view_name),
      'SELECT'
    ) THEN
      RAISE EXCEPTION 'authenticated must retain SELECT on public.%', view_name
        USING ERRCODE = '42501';
    END IF;

    IF has_table_privilege('authenticated', format('%I.%I', 'public', view_name), 'INSERT')
       OR has_table_privilege('authenticated', format('%I.%I', 'public', view_name), 'UPDATE')
       OR has_table_privilege('authenticated', format('%I.%I', 'public', view_name), 'DELETE')
       OR has_table_privilege('authenticated', format('%I.%I', 'public', view_name), 'TRUNCATE')
       OR has_table_privilege('authenticated', format('%I.%I', 'public', view_name), 'REFERENCES')
       OR has_table_privilege('authenticated', format('%I.%I', 'public', view_name), 'TRIGGER') THEN
      RAISE EXCEPTION 'authenticated has a non-SELECT privilege on public.%', view_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$graph_view_authenticated_read_only$;
