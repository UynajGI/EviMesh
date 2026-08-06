ALTER TABLE "verification_receipts" ADD COLUMN "run_id" text NOT NULL;
ALTER TABLE "verification_receipts" ADD CONSTRAINT "verification_receipts_run_id_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("run_id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "verification_receipts" ADD COLUMN "duplicate_of_receipt_id" text;
ALTER TABLE "verification_receipts" ADD CONSTRAINT "verification_receipts_duplicate_of_receipt_id_verification_receipts_receipt_id_fk" FOREIGN KEY ("duplicate_of_receipt_id") REFERENCES "public"."verification_receipts"("receipt_id") ON DELETE restrict ON UPDATE no action;
