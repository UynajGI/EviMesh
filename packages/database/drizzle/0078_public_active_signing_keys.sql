DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "public_read_active_signing_keys" ON "signing_keys"
      FOR SELECT TO anon, authenticated
      USING ("revoked_at" IS NULL AND "deleted_at" IS NULL);
  END IF;
END;
$$;
