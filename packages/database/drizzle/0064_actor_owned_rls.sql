DO $$
DECLARE
  table_name text;
  owned_tables constant text[] := ARRAY['actor_profiles', 'signing_keys', 'api_tokens'];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    FOREACH table_name IN ARRAY owned_tables
    LOOP
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO authenticated
         USING (EXISTS (
           SELECT 1 FROM public.identities AS identity
           WHERE identity.actor_id = %I.actor_id
             AND identity.subject = auth.uid()::text
         ))
         WITH CHECK (EXISTS (
           SELECT 1 FROM public.identities AS identity
           WHERE identity.actor_id = %I.actor_id
             AND identity.subject = auth.uid()::text
         ))',
        'actor_owned_' || table_name,
        table_name,
        table_name,
        table_name
      );
    END LOOP;
  END IF;
END;
$$;
