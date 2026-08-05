ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_organization_id_organizations_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_actor_id_actors_actor_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE cascade ON UPDATE no action;
