DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "public_read_signing_keys" ON "signing_keys"
      FOR SELECT TO anon, authenticated
      USING ("deleted_at" IS NULL);
  END IF;
END;
$$;
