-- Legacy Run rows predate key-qualified signatures, so this column must remain
-- nullable for those immutable receipts. The application requires it on every
-- new Run and the foreign key preserves the referenced verification material.
ALTER TABLE "runs" ADD COLUMN "signing_key_id" text;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_signing_key_id_signing_keys_key_id_fk" FOREIGN KEY ("signing_key_id") REFERENCES "public"."signing_keys"("key_id") ON DELETE restrict ON UPDATE no action;
