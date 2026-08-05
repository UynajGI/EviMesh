DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'verification_contract_revisions_contract_id_verification_contracts_contract_id_fk'
  ) THEN
    ALTER TABLE "verification_contract_revisions"
      DROP CONSTRAINT "verification_contract_revisions_contract_id_verification_contracts_contract_id_fk";
  END IF;
END $$;
