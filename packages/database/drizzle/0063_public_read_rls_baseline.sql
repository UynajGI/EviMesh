DO $$
DECLARE
  table_name text;
  public_tables constant text[] := ARRAY[
    'projects', 'project_revisions', 'questions', 'question_revisions',
    'research_contracts', 'research_contract_revisions', 'tasks', 'task_revisions',
    'task_dependencies', 'claims', 'claim_revisions', 'claim_relations',
    'artifacts', 'artifact_revisions', 'artifact_locations', 'evidence',
    'evidence_claim_links', 'verification_contracts', 'verification_contract_revisions',
    'verification_policies', 'verification_policy_revisions', 'verification_receipts',
    'verification_findings', 'challenges', 'challenge_revisions', 'challenge_impacts',
    'frontier_snapshots', 'frontier_members', 'runs', 'run_inputs', 'run_outputs',
    'contribution_statements', 'contribution_edges', 'research_events', 'research_event_parents'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH table_name IN ARRAY public_tables
    LOOP
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO anon USING (true)',
        'public_read_' || table_name,
        table_name
      );
    END LOOP;
  END IF;
END;
$$;
