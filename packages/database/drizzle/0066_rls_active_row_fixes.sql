DO $$
DECLARE
  table_name text;
  lifecycle_tables constant text[] := ARRAY[
    'projects', 'questions', 'research_contracts', 'tasks', 'task_dependencies',
    'claims', 'claim_relations', 'artifacts', 'verification_contracts',
    'verification_policies', 'challenges'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH table_name IN ARRAY lifecycle_tables
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'public_read_' || table_name, table_name);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO anon USING (deleted_at IS NULL)',
        'public_read_' || table_name,
        table_name
      );
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY identities_read_own_subject ON identities
      FOR SELECT TO authenticated
      USING (subject = auth.uid()::text)
    $policy$;
  END IF;
END;
$$;
