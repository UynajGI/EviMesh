CREATE OR REPLACE FUNCTION enable_public_table_rls()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  command record;
BEGIN
  FOR command IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
      AND object_type = 'table'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', command.object_identity);
  END LOOP;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT format('%I.%I', schemaname, tablename) AS identifier
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_record.identifier);
  END LOOP;
END;
$$;
--> statement-breakpoint
CREATE EVENT TRIGGER public_table_rls_default_trigger
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION enable_public_table_rls();
