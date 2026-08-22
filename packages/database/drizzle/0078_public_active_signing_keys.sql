CREATE POLICY "public_read_active_signing_keys" ON "signing_keys"
  FOR SELECT TO anon, authenticated
  USING ("revoked_at" IS NULL AND "deleted_at" IS NULL);
