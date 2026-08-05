DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY project_member_read_own_memberships ON project_members
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM public.identities AS identity
        WHERE identity.actor_id = project_members.actor_id
          AND identity.subject = auth.uid()::text
      ))
    $policy$;
  END IF;
END;
$$;
