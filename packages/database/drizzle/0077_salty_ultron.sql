CREATE TYPE "public"."interaction_kind" AS ENUM('helpful', 'favorite', 'watch', 'view');--> statement-breakpoint
CREATE TABLE "engagement_interactions" (
	"interaction_id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"kind" "interaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_interactions_object_type_nonempty" CHECK ("engagement_interactions"."object_type" <> ''),
	CONSTRAINT "engagement_interactions_object_id_nonempty" CHECK ("engagement_interactions"."object_id" <> '')
);
--> statement-breakpoint
CREATE TABLE "recommendation_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"rank" integer NOT NULL,
	"reason" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text DEFAULT 'implicit-itemitem' NOT NULL,
	CONSTRAINT "recommendation_cache_object_type_nonempty" CHECK ("recommendation_cache"."object_type" <> ''),
	CONSTRAINT "recommendation_cache_object_id_nonempty" CHECK ("recommendation_cache"."object_id" <> ''),
	CONSTRAINT "recommendation_cache_rank_positive" CHECK ("recommendation_cache"."rank" >= 1)
);
--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "auth_subject" text;--> statement-breakpoint
ALTER TABLE "engagement_interactions" ADD CONSTRAINT "engagement_interactions_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_cache" ADD CONSTRAINT "recommendation_cache_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "engagement_interactions_unique" ON "engagement_interactions" USING btree ("actor_id","object_type","object_id","kind");--> statement-breakpoint
CREATE INDEX "engagement_interactions_object_idx" ON "engagement_interactions" USING btree ("object_type","object_id");--> statement-breakpoint
CREATE INDEX "engagement_interactions_actor_idx" ON "engagement_interactions" USING btree ("actor_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_cache_unique" ON "recommendation_cache" USING btree ("actor_id","object_type","object_id");--> statement-breakpoint
CREATE INDEX "recommendation_cache_actor_rank_idx" ON "recommendation_cache" USING btree ("actor_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "actors_auth_subject_unique" ON "actors" USING btree ("auth_subject") WHERE auth_subject is not null;--> statement-breakpoint
-- Row-level security for client-token writes through PostgREST. Guarded on
-- the Supabase auth schema so plain Postgres (local/self-hosted) skips RLS.
DO $rls$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    RETURN;
  END IF;

  -- Personal engagement signals: an authenticated user touches only rows of
  -- the actor their supabase identity is bound to. Counts stay private.
  ALTER TABLE public.engagement_interactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY engagement_interactions_own ON public.engagement_interactions
    FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.identities i
      WHERE i.provider = 'supabase'
        AND i.subject = auth.uid()::text
        AND i.actor_id = engagement_interactions.actor_id
        AND i.deleted_at IS NULL))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.identities i
      WHERE i.provider = 'supabase'
        AND i.subject = auth.uid()::text
        AND i.actor_id = engagement_interactions.actor_id
        AND i.deleted_at IS NULL));

  -- Recommendation cache: read own rows; only the offline training job
  -- (table owner, direct Postgres) writes.
  ALTER TABLE public.recommendation_cache ENABLE ROW LEVEL SECURITY;
  CREATE POLICY recommendation_cache_read_own ON public.recommendation_cache
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.identities i
      WHERE i.provider = 'supabase'
        AND i.subject = auth.uid()::text
        AND i.actor_id = recommendation_cache.actor_id
        AND i.deleted_at IS NULL));

  -- Identity bindings: a user sees and creates only their own subject, and
  -- only onto an actor row pinned to that subject (anti-hijack).
  ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;
  CREATE POLICY identities_own_subject ON public.identities
    FOR ALL TO authenticated
    USING (provider = 'supabase' AND subject = auth.uid()::text)
    WITH CHECK (provider = 'supabase' AND subject = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.actors a
        WHERE a.actor_id = identities.actor_id
          AND a.auth_subject = auth.uid()::text));

  -- Actor directory stays world-readable; self-provisioned inserts are
  -- pinned to the caller's subject. No update/delete policy (server-side).
  ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;
  CREATE POLICY actors_read_directory ON public.actors
    FOR SELECT TO anon, authenticated USING (true);
  CREATE POLICY actors_insert_self ON public.actors
    FOR INSERT TO authenticated
    WITH CHECK (auth_subject = auth.uid()::text
      AND identity_strength = 'self_declared'
      AND actor_type IN ('human', 'maintainer'));
END
$rls$;