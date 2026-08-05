CREATE TABLE "organization_members" (
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organization_members_pkey" PRIMARY KEY("organization_id","actor_id")
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE cascade ON UPDATE no action;