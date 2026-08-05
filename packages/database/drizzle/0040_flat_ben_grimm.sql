CREATE TYPE "public"."finding_severity" AS ENUM('critical', 'major', 'warning', 'note');--> statement-breakpoint
CREATE TABLE "verification_findings" (
	"finding_id" text PRIMARY KEY NOT NULL,
	"receipt_id" text NOT NULL,
	"severity" "finding_severity" NOT NULL,
	"code" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_findings" ADD CONSTRAINT "verification_findings_receipt_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."verification_receipts"("receipt_id") ON DELETE restrict ON UPDATE no action;