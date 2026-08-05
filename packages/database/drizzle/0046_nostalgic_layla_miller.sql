CREATE UNIQUE INDEX IF NOT EXISTS "frontier_snapshots_project_sequence_idx" ON "frontier_snapshots" USING btree ("project_id","sequence");
