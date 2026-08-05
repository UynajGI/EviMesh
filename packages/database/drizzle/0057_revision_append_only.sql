CREATE OR REPLACE FUNCTION prevent_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER project_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON project_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
--> statement-breakpoint
CREATE TRIGGER question_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON question_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
--> statement-breakpoint
CREATE TRIGGER research_contract_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON research_contract_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
--> statement-breakpoint
CREATE TRIGGER task_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON task_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
--> statement-breakpoint
CREATE TRIGGER claim_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON claim_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
--> statement-breakpoint
CREATE TRIGGER artifact_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON artifact_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
--> statement-breakpoint
CREATE TRIGGER verification_contract_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON verification_contract_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
--> statement-breakpoint
CREATE TRIGGER verification_policy_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON verification_policy_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
--> statement-breakpoint
CREATE TRIGGER challenge_revisions_append_only_trigger
BEFORE UPDATE OR DELETE ON challenge_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_revision_mutation();
