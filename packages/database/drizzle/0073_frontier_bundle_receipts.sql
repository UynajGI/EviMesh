CREATE TABLE "mirror_receipts" (
	"mirror_receipt_id" text PRIMARY KEY NOT NULL,
	"frontier_snapshot_id" text NOT NULL,
	"provider" text NOT NULL,
	"release_url" text NOT NULL,
	"asset_sha256" text NOT NULL,
	"size_bytes" bigint,
	"mirrored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mirror_receipts_asset_sha256_format" CHECK ("mirror_receipts"."asset_sha256" ~* '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "witness_receipts" (
	"witness_receipt_id" text PRIMARY KEY NOT NULL,
	"checkpoint_id" text NOT NULL,
	"witness_id" text NOT NULL,
	"public_key" text NOT NULL,
	"signature" text NOT NULL,
	"signed_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "witness_receipts_witness_id_nonempty" CHECK (length("witness_receipts"."witness_id") > 0)
);
--> statement-breakpoint
ALTER TABLE "mirror_receipts" ADD CONSTRAINT "mirror_receipts_frontier_snapshot_fk" FOREIGN KEY ("frontier_snapshot_id") REFERENCES "public"."frontier_snapshots"("snapshot_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "witness_receipts" ADD CONSTRAINT "witness_receipts_checkpoint_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."merkle_checkpoints"("checkpoint_id") ON DELETE cascade ON UPDATE no action;
