CREATE TABLE "signature_nonces" (
	"actor_id" text NOT NULL,
	"key_id" text NOT NULL,
	"nonce" text NOT NULL,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signature_nonces_actor_key_nonce_unique" UNIQUE("actor_id","key_id","nonce")
);
--> statement-breakpoint
ALTER TABLE "signature_nonces" ADD CONSTRAINT "signature_nonces_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signature_nonces" ADD CONSTRAINT "signature_nonces_key_fk" FOREIGN KEY ("key_id") REFERENCES "public"."signing_keys"("key_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signature_nonces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."signature_nonces" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."signature_nonces" FROM "anon", "authenticated";
--> statement-breakpoint
GRANT INSERT, SELECT ON TABLE "public"."signature_nonces" TO "service_role";
