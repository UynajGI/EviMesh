CREATE TABLE "private"."admission_audit_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admission_audit_events_type_allowed" CHECK ("private"."admission_audit_events"."event_type" in ('onboarding.completed', 'signing_key.registered', 'signing_key.revoked', 'project_application.submitted', 'project_application.withdrawn', 'project_application.approved', 'project_application.rejected', 'project_invitation.created', 'project_invitation.accepted', 'project_invitation.declined', 'project_invitation.expired', 'project_invitation.revoked', 'project_membership.role_changed', 'project_membership.removed', 'project_membership.reactivated')),
	CONSTRAINT "admission_audit_events_subject_type_allowed" CHECK ("private"."admission_audit_events"."subject_type" in ('actor', 'signing_key', 'project_application', 'project_invitation', 'project_membership'))
);
--> statement-breakpoint
CREATE TABLE "private"."admission_feature_gates" (
	"gate" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admission_feature_gates_name_allowed" CHECK ("private"."admission_feature_gates"."gate" in ('project_approval_graph_write'))
);
--> statement-breakpoint
CREATE TABLE "private"."project_applications" (
	"application_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_actor_id" text NOT NULL,
	"proposed_project_id" text NOT NULL,
	"proposed_name" text NOT NULL,
	"proposed_summary" text NOT NULL,
	"proposed_license" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_actor_id" text,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"withdrawn_at" timestamp with time zone,
	"approved_project_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_applications_status_allowed" CHECK ("private"."project_applications"."status" in ('pending', 'approved', 'rejected', 'withdrawn')),
	CONSTRAINT "project_applications_project_id_canonical" CHECK ("private"."project_applications"."proposed_project_id" ~ '^project_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
	CONSTRAINT "project_applications_name_length" CHECK (char_length("private"."project_applications"."proposed_name") between 1 and 200),
	CONSTRAINT "project_applications_summary_length" CHECK (char_length("private"."project_applications"."proposed_summary") between 1 and 4000),
	CONSTRAINT "project_applications_license_length" CHECK (char_length("private"."project_applications"."proposed_license") between 1 and 200),
	CONSTRAINT "project_applications_lifecycle_shape" CHECK (
        ("private"."project_applications"."status" = 'pending' and "private"."project_applications"."decided_by_actor_id" is null and "private"."project_applications"."decided_at" is null and "private"."project_applications"."decision_reason" is null and "private"."project_applications"."withdrawn_at" is null and "private"."project_applications"."approved_project_id" is null)
        or ("private"."project_applications"."status" = 'approved' and "private"."project_applications"."decided_by_actor_id" is not null and "private"."project_applications"."decided_at" is not null and "private"."project_applications"."decision_reason" is not null and char_length("private"."project_applications"."decision_reason") between 1 and 1000 and "private"."project_applications"."withdrawn_at" is null and "private"."project_applications"."approved_project_id" is not null)
        or ("private"."project_applications"."status" = 'rejected' and "private"."project_applications"."decided_by_actor_id" is not null and "private"."project_applications"."decided_at" is not null and "private"."project_applications"."decision_reason" is not null and char_length("private"."project_applications"."decision_reason") between 1 and 1000 and "private"."project_applications"."withdrawn_at" is null and "private"."project_applications"."approved_project_id" is null)
        or ("private"."project_applications"."status" = 'withdrawn' and "private"."project_applications"."decided_by_actor_id" is null and "private"."project_applications"."decided_at" is null and "private"."project_applications"."decision_reason" is null and "private"."project_applications"."withdrawn_at" is not null and "private"."project_applications"."approved_project_id" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "private"."project_invitations" (
	"invitation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"invited_actor_id" text NOT NULL,
	"invited_by_actor_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"revoked_by_actor_id" text,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_invitations_role_allowed" CHECK ("private"."project_invitations"."role" in ('maintainer', 'contributor', 'viewer')),
	CONSTRAINT "project_invitations_status_allowed" CHECK ("private"."project_invitations"."status" in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
	CONSTRAINT "project_invitations_expiry_after_creation" CHECK ("private"."project_invitations"."expires_at" > "private"."project_invitations"."created_at"),
	CONSTRAINT "project_invitations_lifecycle_shape" CHECK (
        ("private"."project_invitations"."status" = 'pending' and "private"."project_invitations"."responded_at" is null and "private"."project_invitations"."revoked_by_actor_id" is null and "private"."project_invitations"."revoked_at" is null and "private"."project_invitations"."revocation_reason" is null)
        or ("private"."project_invitations"."status" in ('accepted', 'declined', 'expired') and "private"."project_invitations"."responded_at" is not null and "private"."project_invitations"."revoked_by_actor_id" is null and "private"."project_invitations"."revoked_at" is null and "private"."project_invitations"."revocation_reason" is null)
        or ("private"."project_invitations"."status" = 'revoked' and "private"."project_invitations"."responded_at" is null and "private"."project_invitations"."revoked_by_actor_id" is not null and "private"."project_invitations"."revoked_at" is not null and "private"."project_invitations"."revocation_reason" is not null and char_length("private"."project_invitations"."revocation_reason") between 1 and 500)
      )
);
--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "profile_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "invited_by_actor_id" text;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "joined_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "removed_by_actor_id" text;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "removal_reason" text;--> statement-breakpoint
ALTER TABLE "signing_keys" ADD COLUMN "fingerprint" text;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "private"."decode_canonical_ed25519_spki"(p_public_key text)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
DECLARE
  decoded_der bytea;
  canonical_value text;
BEGIN
  IF p_public_key !~ '^[A-Za-z0-9_-]{59}$' THEN
    RAISE EXCEPTION '[SIGNING_KEY_PUBLIC_KEY_INVALID] public key must be unpadded base64url Ed25519 SPKI'
      USING ERRCODE = '22023';
  END IF;

  decoded_der := pg_catalog.decode(pg_catalog.translate(p_public_key, '-_', '+/') || '=', 'base64');
  canonical_value := pg_catalog.rtrim(
    pg_catalog.translate(pg_catalog.encode(decoded_der, 'base64'), '+/', '-_'),
    '='
  );
  IF pg_catalog.octet_length(decoded_der) <> 44
     OR pg_catalog.substring(decoded_der, 1, 12) <> pg_catalog.decode('302a300506032b6570032100', 'hex')
     OR canonical_value IS DISTINCT FROM p_public_key THEN
    RAISE EXCEPTION '[SIGNING_KEY_PUBLIC_KEY_INVALID] public key must be canonical 44-byte Ed25519 SPKI DER'
      USING ERRCODE = '22023';
  END IF;
  RETURN decoded_der;
END;
$$;--> statement-breakpoint
UPDATE "signing_keys"
SET "fingerprint" = 'sha256:' || pg_catalog.encode(
  pg_catalog.sha256("private"."decode_canonical_ed25519_spki"("public_key")),
  'hex'
)
WHERE "fingerprint" IS NULL;--> statement-breakpoint
ALTER TABLE "signing_keys" ALTER COLUMN "fingerprint" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "signing_keys" ADD COLUMN "label" text DEFAULT 'Signing key' NOT NULL;--> statement-breakpoint
ALTER TABLE "signing_keys" ADD COLUMN "revocation_reason" text;--> statement-breakpoint
UPDATE "signing_keys"
SET "revocation_reason" = 'revoked before public-admission audit'
WHERE "revoked_at" IS NOT NULL AND "revocation_reason" IS NULL;--> statement-breakpoint
ALTER TABLE "private"."admission_audit_events" ADD CONSTRAINT "admission_audit_events_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_applications" ADD CONSTRAINT "project_applications_applicant_actor_id_actors_actor_id_fk" FOREIGN KEY ("applicant_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_applications" ADD CONSTRAINT "project_applications_decided_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("decided_by_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_applications" ADD CONSTRAINT "project_applications_approved_project_id_projects_project_id_fk" FOREIGN KEY ("approved_project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_invitations" ADD CONSTRAINT "project_invitations_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_invitations" ADD CONSTRAINT "project_invitations_invited_actor_id_actors_actor_id_fk" FOREIGN KEY ("invited_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_invitations" ADD CONSTRAINT "project_invitations_invited_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("invited_by_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_invitations" ADD CONSTRAINT "project_invitations_revoked_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("revoked_by_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admission_audit_events_subject_time_idx" ON "private"."admission_audit_events" USING btree ("subject_type","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "admission_audit_events_actor_time_idx" ON "private"."admission_audit_events" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_applications_one_pending_actor" ON "private"."project_applications" USING btree ("applicant_actor_id") WHERE "private"."project_applications"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "project_applications_one_pending_project_id" ON "private"."project_applications" USING btree ("proposed_project_id") WHERE "private"."project_applications"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "project_applications_approved_project_unique" ON "private"."project_applications" USING btree ("approved_project_id") WHERE "private"."project_applications"."approved_project_id" is not null;--> statement-breakpoint
CREATE INDEX "project_applications_status_submitted_idx" ON "private"."project_applications" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_invitations_one_pending_recipient" ON "private"."project_invitations" USING btree ("project_id","invited_actor_id") WHERE "private"."project_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "project_invitations_recipient_status_idx" ON "private"."project_invitations" USING btree ("invited_actor_id","status");--> statement-breakpoint
CREATE INDEX "project_invitations_expiry_idx" ON "private"."project_invitations" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invited_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("invited_by_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_removed_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("removed_by_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_members_actor_status_idx" ON "project_members" USING btree ("actor_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_keys_fingerprint_unique" ON "signing_keys" USING btree ("fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_keys_one_active_per_actor" ON "signing_keys" USING btree ("actor_id") WHERE "signing_keys"."revoked_at" is null and "signing_keys"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_terms_acceptance_shape" CHECK (("actors"."terms_version" is null and "actors"."terms_accepted_at" is null) or ("actors"."terms_version" is not null and char_length("actors"."terms_version") between 1 and 100 and "actors"."terms_accepted_at" is not null));--> statement-breakpoint
ALTER TABLE "actors" ADD CONSTRAINT "actors_profile_completion_requires_terms" CHECK ("actors"."profile_completed_at" is null or ("actors"."terms_version" is not null and "actors"."terms_accepted_at" is not null));--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_role_allowed" CHECK ("project_members"."role" in ('owner', 'maintainer', 'contributor', 'viewer'));--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_status_allowed" CHECK ("project_members"."status" in ('active', 'removed'));--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_lifecycle_shape" CHECK (("project_members"."status" = 'active' and "project_members"."removed_by_actor_id" is null and "project_members"."removed_at" is null and "project_members"."removal_reason" is null and "project_members"."deleted_at" is null) or ("project_members"."status" = 'removed' and "project_members"."removed_by_actor_id" is not null and "project_members"."removed_at" is not null and "project_members"."removal_reason" is not null and char_length("project_members"."removal_reason") between 1 and 500 and "project_members"."deleted_at" is not null));--> statement-breakpoint
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_algorithm_ed25519" CHECK ("signing_keys"."algorithm" = 'Ed25519');--> statement-breakpoint
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_public_key_canonical_spki" CHECK ("signing_keys"."public_key" ~ '^[A-Za-z0-9_-]{59}$');--> statement-breakpoint
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_fingerprint_shape" CHECK ("signing_keys"."fingerprint" ~ '^sha256:[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_label_length" CHECK (char_length("signing_keys"."label") between 1 and 100);--> statement-breakpoint
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_revocation_shape" CHECK (("signing_keys"."revoked_at" is null and "signing_keys"."revocation_reason" is null) or ("signing_keys"."revoked_at" is not null and "signing_keys"."revocation_reason" is not null and char_length("signing_keys"."revocation_reason") between 1 and 500));--> statement-breakpoint

-- These governance/account tables are deliberately outside the research DAG.
-- Keep the base rows unreachable even to PostgREST's service_role; the fixed
-- SECURITY DEFINER RPC allowlist below is the only mutation surface.
ALTER TABLE "private"."project_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "private"."project_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "private"."admission_audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "private"."admission_feature_gates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "private"."project_applications" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "private"."project_invitations" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "private"."admission_audit_events" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "private"."admission_feature_gates" FROM PUBLIC;--> statement-breakpoint
INSERT INTO "private"."admission_feature_gates" ("gate", "enabled", "updated_by")
VALUES ('project_approval_graph_write', false, '0086_public_admission');--> statement-breakpoint
DO $admission_table_grants$
DECLARE
  role_name text;
  table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'private.project_applications',
        'private.project_invitations',
        'private.admission_audit_events',
        'private.admission_feature_gates'
      ] LOOP
        EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', table_name, role_name);
      END LOOP;
    END IF;
  END LOOP;

  -- Browser roles never read the private signing-key label/revocation reason,
  -- or mutate signing keys/project membership directly.
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.signing_keys FROM %I', role_name);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.project_members FROM %I', role_name);
    END IF;
  END LOOP;
END
$admission_table_grants$;--> statement-breakpoint

DROP POLICY IF EXISTS "public_read_signing_keys" ON "public"."signing_keys";--> statement-breakpoint
DROP POLICY IF EXISTS "actor_owned_signing_keys" ON "public"."signing_keys";--> statement-breakpoint
REVOKE ALL ON TABLE "public"."signing_keys" FROM PUBLIC;--> statement-breakpoint
CREATE OR REPLACE VIEW "public"."signing_key_verification_keys"
WITH (security_barrier = true)
AS
SELECT
  "key_id",
  "actor_id",
  "algorithm",
  "public_key",
  "fingerprint",
  "created_at",
  "revoked_at"
FROM "public"."signing_keys"
WHERE "deleted_at" IS NULL;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."signing_key_verification_keys" FROM PUBLIC;--> statement-breakpoint
DO $signing_key_projection_grants$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.signing_key_verification_keys TO %I', role_name);
    END IF;
  END LOOP;
END
$signing_key_projection_grants$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."prevent_admission_audit_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '[ADMISSION_AUDIT_IMMUTABLE] admission audit events are append-only'
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "admission_audit_events_append_only"
BEFORE UPDATE OR DELETE ON "private"."admission_audit_events"
FOR EACH ROW EXECUTE FUNCTION "private"."prevent_admission_audit_event_mutation"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."prepare_signing_key"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  computed_fingerprint text;
  decoded_der bytea;
BEGIN
  decoded_der := "private"."decode_canonical_ed25519_spki"(NEW.public_key);
  computed_fingerprint := 'sha256:' || pg_catalog.encode(
    pg_catalog.sha256(decoded_der),
    'hex'
  );

  IF NEW.fingerprint IS NOT NULL AND NEW.fingerprint <> computed_fingerprint THEN
    RAISE EXCEPTION '[SIGNING_KEY_FINGERPRINT_MISMATCH] fingerprint must match the public key'
      USING ERRCODE = '22000';
  END IF;
  NEW.fingerprint := computed_fingerprint;

  IF TG_OP = 'UPDATE' AND (
    NEW.key_id IS DISTINCT FROM OLD.key_id
    OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
    OR NEW.algorithm IS DISTINCT FROM OLD.algorithm
    OR NEW.public_key IS DISTINCT FROM OLD.public_key
    OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION '[SIGNING_KEY_MATERIAL_IMMUTABLE] signing key identity and public material cannot change'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "signing_keys_prepare_and_protect"
BEFORE INSERT OR UPDATE ON "public"."signing_keys"
FOR EACH ROW EXECUTE FUNCTION "private"."prepare_signing_key"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."actor_onboarding_complete"(
  p_actor_id text,
  p_auth_subject text,
  p_terms_version text,
  p_accepted_at timestamptz,
  p_display_name text,
  p_bio text,
  p_avatar_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_row "public"."actors"%ROWTYPE;
  email_is_verified boolean := false;
BEGIN
  IF p_actor_id IS NULL OR pg_catalog.btrim(p_actor_id) = ''
     OR p_auth_subject IS NULL OR pg_catalog.btrim(p_auth_subject) = ''
     OR p_terms_version IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_terms_version)) NOT BETWEEN 1 AND 100
     OR p_display_name IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_display_name)) NOT BETWEEN 1 AND 200
     OR p_accepted_at IS NULL OR p_accepted_at > pg_catalog.now() + interval '5 minutes' THEN
    RAISE EXCEPTION '[ONBOARDING_INPUT_INVALID] actor, auth subject, terms, acceptance time, and display name are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_bio IS NOT NULL AND pg_catalog.char_length(p_bio) > 5000 THEN
    RAISE EXCEPTION '[ONBOARDING_INPUT_INVALID] bio is too long' USING ERRCODE = '22023';
  END IF;
  IF p_avatar_url IS NOT NULL AND pg_catalog.char_length(p_avatar_url) > 2000 THEN
    RAISE EXCEPTION '[ONBOARDING_INPUT_INVALID] avatar URL is too long' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO actor_row
  FROM "public"."actors"
  WHERE "actor_id" = pg_catalog.btrim(p_actor_id)
    AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND OR actor_row.auth_subject IS DISTINCT FROM pg_catalog.btrim(p_auth_subject)
     OR actor_row.actor_type NOT IN ('human', 'maintainer') THEN
    RAISE EXCEPTION '[ONBOARDING_ACTOR_FORBIDDEN] active human actor binding was not found'
      USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION '[ONBOARDING_AUTH_UNAVAILABLE] Supabase auth users are unavailable'
      USING ERRCODE = '55000';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM auth.users WHERE id::text = $1 AND email_confirmed_at IS NOT NULL)'
    INTO email_is_verified
    USING pg_catalog.btrim(p_auth_subject);
  IF email_is_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION '[ONBOARDING_EMAIL_NOT_VERIFIED] verified Supabase email is required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE "public"."actors"
  SET "terms_version" = pg_catalog.btrim(p_terms_version),
      "terms_accepted_at" = CASE
        WHEN "terms_version" = pg_catalog.btrim(p_terms_version) AND "terms_accepted_at" IS NOT NULL
          THEN LEAST("terms_accepted_at", p_accepted_at)
        ELSE p_accepted_at
      END,
      "profile_completed_at" = COALESCE("profile_completed_at", p_accepted_at),
      "updated_at" = p_accepted_at
  WHERE "actor_id" = actor_row.actor_id;

  INSERT INTO "public"."actor_profiles" (
    "actor_id", "display_name", "bio", "avatar_url", "created_at", "updated_at", "deleted_at"
  ) VALUES (
    actor_row.actor_id, pg_catalog.btrim(p_display_name), NULLIF(pg_catalog.btrim(p_bio), ''),
    NULLIF(pg_catalog.btrim(p_avatar_url), ''), p_accepted_at, p_accepted_at, NULL
  )
  ON CONFLICT ("actor_id") DO UPDATE
  SET "display_name" = EXCLUDED."display_name",
      "bio" = EXCLUDED."bio",
      "avatar_url" = EXCLUDED."avatar_url",
      "updated_at" = EXCLUDED."updated_at",
      "deleted_at" = NULL;

  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'onboarding.completed', actor_row.actor_id, 'actor', actor_row.actor_id,
    pg_catalog.jsonb_build_object('termsVersion', pg_catalog.btrim(p_terms_version)), p_accepted_at
  );

  RETURN pg_catalog.jsonb_build_object(
    'actorId', actor_row.actor_id,
    'termsVersion', pg_catalog.btrim(p_terms_version),
    'termsAcceptedAt', p_accepted_at,
    'profileCompletedAt', p_accepted_at,
    'displayName', pg_catalog.btrim(p_display_name)
  );
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."signing_key_list"(p_actor_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'keyId', key_row."key_id",
        'actorId', key_row."actor_id",
        'algorithm', key_row."algorithm",
        'publicKey', key_row."public_key",
        'fingerprint', key_row."fingerprint",
        'label', key_row."label",
        'createdAt', key_row."created_at",
        'revokedAt', key_row."revoked_at",
        'revocationReason', key_row."revocation_reason"
      ) ORDER BY key_row."created_at" DESC, key_row."key_id"
    ),
    '[]'::jsonb
  )
  FROM "public"."signing_keys" AS key_row
  WHERE key_row."actor_id" = p_actor_id
    AND key_row."deleted_at" IS NULL;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."signing_key_register"(
  p_actor_id text,
  p_key_id text,
  p_public_key text,
  p_label text,
  p_created_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_row "public"."actors"%ROWTYPE;
  key_row "public"."signing_keys"%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR pg_catalog.btrim(p_actor_id) = ''
     OR p_key_id IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_key_id)) NOT BETWEEN 1 AND 200
     OR p_public_key IS NULL OR pg_catalog.btrim(p_public_key) !~ '^[A-Za-z0-9_-]{59}$'
     OR p_label IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_label)) NOT BETWEEN 1 AND 100
     OR p_created_at IS NULL OR p_created_at > pg_catalog.now() + interval '5 minutes' THEN
    RAISE EXCEPTION '[SIGNING_KEY_INPUT_INVALID] public Ed25519 key, id, label, and creation time are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO actor_row
  FROM "public"."actors"
  WHERE "actor_id" = pg_catalog.btrim(p_actor_id)
    AND "actor_type" IN ('human', 'maintainer')
    AND "terms_accepted_at" IS NOT NULL
    AND "profile_completed_at" IS NOT NULL
    AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[SIGNING_KEY_ACTOR_FORBIDDEN] completed active human actor was not found'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "public"."signing_keys"
    WHERE "actor_id" = actor_row.actor_id AND "revoked_at" IS NULL AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[SIGNING_KEY_ALREADY_ACTIVE] actor already has an active signing key'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO "public"."signing_keys" (
    "key_id", "actor_id", "algorithm", "public_key", "label", "created_at", "updated_at"
  ) VALUES (
    pg_catalog.btrim(p_key_id), actor_row.actor_id, 'Ed25519', pg_catalog.btrim(p_public_key),
    pg_catalog.btrim(p_label), p_created_at, p_created_at
  ) RETURNING * INTO key_row;

  UPDATE "public"."actors"
  SET "public_key_fingerprint" = key_row.fingerprint, "updated_at" = p_created_at
  WHERE "actor_id" = actor_row.actor_id;

  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'signing_key.registered', actor_row.actor_id, 'signing_key', key_row.key_id,
    pg_catalog.jsonb_build_object('fingerprint', key_row.fingerprint, 'label', key_row.label), p_created_at
  );

  RETURN pg_catalog.jsonb_build_object(
    'keyId', key_row.key_id, 'actorId', key_row.actor_id, 'algorithm', key_row.algorithm,
    'publicKey', key_row.public_key, 'fingerprint', key_row.fingerprint, 'label', key_row.label,
    'createdAt', key_row.created_at, 'revokedAt', key_row.revoked_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '[SIGNING_KEY_CONFLICT] key id, fingerprint, or active actor key already exists'
      USING ERRCODE = '23505';
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."signing_key_revoke"(
  p_actor_id text,
  p_key_id text,
  p_reason text,
  p_revoked_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  key_row "public"."signing_keys"%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500
     OR p_revoked_at IS NULL OR p_revoked_at > pg_catalog.now() + interval '5 minutes' THEN
    RAISE EXCEPTION '[SIGNING_KEY_REVOCATION_INVALID] reason and revocation time are required'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO key_row
  FROM "public"."signing_keys"
  WHERE "key_id" = pg_catalog.btrim(p_key_id)
    AND "actor_id" = pg_catalog.btrim(p_actor_id)
    AND "revoked_at" IS NULL
    AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[SIGNING_KEY_NOT_FOUND] active owned signing key was not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE "public"."signing_keys"
  SET "revoked_at" = p_revoked_at,
      "revocation_reason" = pg_catalog.btrim(p_reason),
      "updated_at" = p_revoked_at
  WHERE "key_id" = key_row.key_id
  RETURNING * INTO key_row;
  UPDATE "public"."actors"
  SET "public_key_fingerprint" = NULL, "updated_at" = p_revoked_at
  WHERE "actor_id" = key_row.actor_id AND "public_key_fingerprint" = key_row.fingerprint;

  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'signing_key.revoked', key_row.actor_id, 'signing_key', key_row.key_id,
    pg_catalog.jsonb_build_object('fingerprint', key_row.fingerprint, 'reason', pg_catalog.btrim(p_reason)), p_revoked_at
  );
  RETURN pg_catalog.jsonb_build_object(
    'keyId', key_row.key_id, 'actorId', key_row.actor_id, 'fingerprint', key_row.fingerprint,
    'label', key_row.label, 'revokedAt', key_row.revoked_at, 'revocationReason', key_row.revocation_reason
  );
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_application_submit"(
  p_applicant_actor_id text,
  p_proposed_project_id text,
  p_name text,
  p_summary text,
  p_license text,
  p_submitted_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  application_row "private"."project_applications"%ROWTYPE;
  approval_result jsonb;
BEGIN
  IF p_applicant_actor_id IS NULL OR pg_catalog.btrim(p_applicant_actor_id) = ''
     OR p_proposed_project_id IS NULL
     OR pg_catalog.btrim(p_proposed_project_id) !~ '^project_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR p_name IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_name)) NOT BETWEEN 1 AND 200
     OR p_summary IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_summary)) NOT BETWEEN 1 AND 4000
     OR p_license IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_license)) NOT BETWEEN 1 AND 200
     OR p_submitted_at IS NULL OR p_submitted_at > pg_catalog.now() + interval '5 minutes' THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_INPUT_INVALID] project id, name, summary, license, and time are required'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors"
    WHERE "actor_id" = pg_catalog.btrim(p_applicant_actor_id)
      AND "actor_type" IN ('human', 'maintainer')
      AND "terms_accepted_at" IS NOT NULL
      AND "profile_completed_at" IS NOT NULL
      AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_ACTOR_FORBIDDEN] completed active human actor was not found'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO "private"."project_applications" (
    "applicant_actor_id", "proposed_project_id", "proposed_name", "proposed_summary",
    "proposed_license", "status", "submitted_at", "updated_at"
  ) VALUES (
    pg_catalog.btrim(p_applicant_actor_id), pg_catalog.btrim(p_proposed_project_id), pg_catalog.btrim(p_name),
    pg_catalog.btrim(p_summary), pg_catalog.btrim(p_license), 'pending', p_submitted_at, p_submitted_at
  ) RETURNING * INTO application_row;

  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'project_application.submitted', application_row.applicant_actor_id, 'project_application', application_row.application_id::text,
    pg_catalog.jsonb_build_object('proposedProjectId', application_row.proposed_project_id), p_submitted_at
  );
  RETURN pg_catalog.to_jsonb(application_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_ALREADY_PENDING] actor or project id already has a pending application'
      USING ERRCODE = '23505';
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_application_withdraw"(
  p_application_id uuid,
  p_applicant_actor_id text,
  p_withdrawn_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  application_row "private"."project_applications"%ROWTYPE;
BEGIN
  SELECT * INTO application_row
  FROM "private"."project_applications"
  WHERE "application_id" = p_application_id
  FOR NO KEY UPDATE;
  IF NOT FOUND OR application_row.applicant_actor_id IS DISTINCT FROM pg_catalog.btrim(p_applicant_actor_id) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_NOT_FOUND] owned application was not found' USING ERRCODE = 'P0002';
  END IF;
  IF application_row.status <> 'pending' THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_STATE_INVALID] only pending applications can be withdrawn' USING ERRCODE = '55000';
  END IF;

  UPDATE "private"."project_applications"
  SET "status" = 'withdrawn', "withdrawn_at" = p_withdrawn_at, "updated_at" = p_withdrawn_at
  WHERE "application_id" = p_application_id
  RETURNING * INTO application_row;
  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'project_application.withdrawn', application_row.applicant_actor_id, 'project_application', p_application_id::text,
    '{}'::jsonb, p_withdrawn_at
  );
  RETURN pg_catalog.to_jsonb(application_row);
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_application_decide"(
  p_application_id uuid,
  p_steward_actor_id text,
  p_decision text,
  p_reason text,
  p_decided_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  application_row "private"."project_applications"%ROWTYPE;
  approval_result jsonb;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected')
     OR p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_DECISION_INVALID] approved/rejected decision and reason are required'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors"
    WHERE "actor_id" = pg_catalog.btrim(p_steward_actor_id)
      AND "actor_type" = 'maintainer'
      AND "terms_accepted_at" IS NOT NULL
      AND "profile_completed_at" IS NOT NULL
      AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_STEWARD_FORBIDDEN] active community steward was not found'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO application_row
  FROM "private"."project_applications"
  WHERE "application_id" = p_application_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_NOT_FOUND] application was not found' USING ERRCODE = 'P0002';
  END IF;
  IF application_row.status <> 'pending' THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_STATE_INVALID] application has already been decided' USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors"
    WHERE "actor_id" = application_row.applicant_actor_id
      AND "actor_type" IN ('human', 'maintainer')
      AND "terms_accepted_at" IS NOT NULL
      AND "profile_completed_at" IS NOT NULL
      AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_APPLICANT_INACTIVE] applicant is no longer active' USING ERRCODE = '55000';
  END IF;

  IF p_decision = 'approved' THEN
    IF COALESCE((
      SELECT gate_row."enabled"
      FROM "private"."admission_feature_gates" AS gate_row
      WHERE gate_row."gate" = 'project_approval_graph_write'
    ), false) IS DISTINCT FROM true
       OR pg_catalog.to_regprocedure(
         'private.project_application_approve_with_graph(uuid,text,text,timestamp with time zone)'
       ) IS NULL THEN
      RAISE EXCEPTION '[PROJECT_APPROVAL_GRAPH_WRITE_NOT_READY] project approval is disabled until atomic Graph/Event writes are installed'
        USING ERRCODE = '55000';
    END IF;
    -- Phase3 installs this private contract and flips the private gate in the
    -- same deployment. It must atomically create the signed governance event,
    -- legacy Project/Revision, kernel Node/Revision/crosswalk, owner membership,
    -- application transition and admission audit row. 0086 never synthesizes
    -- an applicant signature and has no legacy-only approval fallback.
    EXECUTE
      'SELECT private.project_application_approve_with_graph($1,$2,$3,$4)'
      INTO approval_result
      USING p_application_id, pg_catalog.btrim(p_steward_actor_id), pg_catalog.btrim(p_reason), p_decided_at;
    RETURN approval_result;
  ELSE
    UPDATE "private"."project_applications"
    SET "status" = 'rejected', "decided_by_actor_id" = pg_catalog.btrim(p_steward_actor_id),
        "decided_at" = p_decided_at, "decision_reason" = pg_catalog.btrim(p_reason),
        "updated_at" = p_decided_at
    WHERE "application_id" = p_application_id
    RETURNING * INTO application_row;
  END IF;

  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'project_application.rejected', pg_catalog.btrim(p_steward_actor_id), 'project_application', p_application_id::text,
    pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason)), p_decided_at
  );
  RETURN pg_catalog.to_jsonb(application_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_PROJECT_CONFLICT] proposed project id already exists'
      USING ERRCODE = '23505';
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_invitation_create"(
  p_project_id text,
  p_invited_actor_id text,
  p_invited_by_actor_id text,
  p_role text,
  p_created_at timestamptz,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_now timestamptz := pg_catalog.clock_timestamp();
  inviter_role text;
  current_project_state "public"."project_state";
  invitation_row "private"."project_invitations"%ROWTYPE;
BEGIN
  -- p_created_at remains in the compatibility signature but is never trusted;
  -- all lifecycle decisions and persisted timestamps use the database clock.
  IF p_project_id IS NULL OR pg_catalog.btrim(p_project_id) = ''
     OR p_invited_actor_id IS NULL OR pg_catalog.btrim(p_invited_actor_id) = ''
     OR p_invited_by_actor_id IS NULL OR pg_catalog.btrim(p_invited_by_actor_id) = ''
     OR p_role IS NULL OR p_role NOT IN ('maintainer', 'contributor', 'viewer')
     OR p_expires_at IS NULL
     OR p_expires_at <= effective_now OR p_expires_at > effective_now + interval '30 days' THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_INPUT_INVALID] role and a 30-day-or-shorter expiry are required'
      USING ERRCODE = '22023';
  END IF;
  SELECT "state" INTO current_project_state
  FROM "public"."projects"
  WHERE "project_id" = pg_catalog.btrim(p_project_id) AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND OR current_project_state <> 'active' THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_PROJECT_INACTIVE] active project was not found'
      USING ERRCODE = '55000';
  END IF;
  SELECT "role" INTO inviter_role
  FROM "public"."project_members"
  WHERE "project_id" = pg_catalog.btrim(p_project_id)
    AND "actor_id" = pg_catalog.btrim(p_invited_by_actor_id)
    AND "status" = 'active' AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND OR inviter_role NOT IN ('owner', 'maintainer') THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_FORBIDDEN] owner or maintainer membership is required'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors"
    WHERE "actor_id" = pg_catalog.btrim(p_invited_actor_id)
      AND "actor_type" IN ('human', 'maintainer')
      AND "terms_accepted_at" IS NOT NULL
      AND "profile_completed_at" IS NOT NULL
      AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_RECIPIENT_INVALID] completed active human recipient was not found'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "public"."project_members"
    WHERE "project_id" = pg_catalog.btrim(p_project_id)
      AND "actor_id" = pg_catalog.btrim(p_invited_actor_id)
      AND "status" = 'active' AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_ALREADY_MEMBER] recipient is already an active project member'
      USING ERRCODE = '23505';
  END IF;

  WITH expired_invitations AS (
    UPDATE "private"."project_invitations"
    SET "status" = 'expired', "responded_at" = effective_now, "updated_at" = effective_now
    WHERE "project_id" = pg_catalog.btrim(p_project_id)
      AND "invited_actor_id" = pg_catalog.btrim(p_invited_actor_id)
      AND "status" = 'pending'
      AND "expires_at" <= effective_now
    RETURNING "invitation_id", "project_id", "invited_actor_id"
  )
  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  )
  SELECT
    'project_invitation.expired', pg_catalog.btrim(p_invited_by_actor_id), 'project_invitation',
    expired_row."invitation_id"::text,
    pg_catalog.jsonb_build_object(
      'projectId', expired_row."project_id",
      'invitedActorId', expired_row."invited_actor_id",
      'reason', 'expired_on_reinvite'
    ),
    effective_now
  FROM expired_invitations AS expired_row;

  INSERT INTO "private"."project_invitations" (
    "project_id", "invited_actor_id", "invited_by_actor_id", "role", "status",
    "created_at", "expires_at", "updated_at"
  ) VALUES (
    pg_catalog.btrim(p_project_id), pg_catalog.btrim(p_invited_actor_id), pg_catalog.btrim(p_invited_by_actor_id),
    p_role, 'pending', effective_now, p_expires_at, effective_now
  ) RETURNING * INTO invitation_row;
  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'project_invitation.created', invitation_row.invited_by_actor_id, 'project_invitation', invitation_row.invitation_id::text,
    pg_catalog.jsonb_build_object('projectId', invitation_row.project_id, 'invitedActorId', invitation_row.invited_actor_id, 'role', invitation_row.role), effective_now
  );
  RETURN pg_catalog.to_jsonb(invitation_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_ALREADY_PENDING] recipient already has a pending invitation'
      USING ERRCODE = '23505';
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_invitation_respond"(
  p_invitation_id uuid,
  p_invited_actor_id text,
  p_response text,
  p_responded_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_now timestamptz := pg_catalog.clock_timestamp();
  invitation_row "private"."project_invitations"%ROWTYPE;
  existing_member "public"."project_members"%ROWTYPE;
  reactivated boolean := false;
BEGIN
  -- p_responded_at is compatibility-only; it cannot backdate or extend state.
  IF p_invited_actor_id IS NULL OR pg_catalog.btrim(p_invited_actor_id) = ''
     OR p_response IS NULL OR p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_RESPONSE_INVALID] response must be accepted or declined'
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO invitation_row
  FROM "private"."project_invitations"
  WHERE "invitation_id" = p_invitation_id
  FOR NO KEY UPDATE;
  IF NOT FOUND OR invitation_row.invited_actor_id IS DISTINCT FROM pg_catalog.btrim(p_invited_actor_id) THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_NOT_FOUND] owned invitation was not found' USING ERRCODE = 'P0002';
  END IF;
  IF invitation_row.status <> 'pending' THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_STATE_INVALID] invitation is no longer pending' USING ERRCODE = '55000';
  END IF;
  IF invitation_row.expires_at <= effective_now THEN
    UPDATE "private"."project_invitations"
    SET "status" = 'expired', "responded_at" = effective_now, "updated_at" = effective_now
    WHERE "invitation_id" = p_invitation_id
    RETURNING * INTO invitation_row;
    INSERT INTO "private"."admission_audit_events" (
      "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
    ) VALUES (
      'project_invitation.expired', invitation_row.invited_actor_id, 'project_invitation', p_invitation_id::text,
      pg_catalog.jsonb_build_object('projectId', invitation_row.project_id, 'reason', 'expired_before_response'), effective_now
    );
    RETURN pg_catalog.to_jsonb(invitation_row);
  END IF;

  IF p_response = 'accepted' THEN
    PERFORM 1
    FROM "public"."projects"
    WHERE "project_id" = invitation_row.project_id
      AND "state" = 'active'
      AND "deleted_at" IS NULL
    FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '[PROJECT_INVITATION_PROJECT_INACTIVE] invitation project is no longer active'
        USING ERRCODE = '55000';
    END IF;
    PERFORM 1
    FROM "public"."actors"
    WHERE "actor_id" = invitation_row.invited_actor_id
      AND "actor_type" IN ('human', 'maintainer')
      AND "terms_accepted_at" IS NOT NULL
      AND "profile_completed_at" IS NOT NULL
      AND "deleted_at" IS NULL
    FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '[PROJECT_INVITATION_RECIPIENT_INVALID] completed active human recipient was not found'
        USING ERRCODE = '55000';
    END IF;
    SELECT * INTO existing_member
    FROM "public"."project_members"
    WHERE "project_id" = invitation_row.project_id AND "actor_id" = invitation_row.invited_actor_id
    FOR NO KEY UPDATE;
    IF FOUND AND existing_member.status = 'active' AND existing_member.deleted_at IS NULL THEN
      RAISE EXCEPTION '[PROJECT_INVITATION_ALREADY_MEMBER] recipient is already an active member' USING ERRCODE = '23505';
    END IF;
    reactivated := FOUND;
    INSERT INTO "public"."project_members" (
      "project_id", "actor_id", "role", "status", "invited_by_actor_id", "joined_at",
      "removed_by_actor_id", "removed_at", "removal_reason", "created_at", "updated_at", "deleted_at"
    ) VALUES (
      invitation_row.project_id, invitation_row.invited_actor_id, invitation_row.role, 'active',
      invitation_row.invited_by_actor_id, effective_now, NULL, NULL, NULL, effective_now, effective_now, NULL
    )
    ON CONFLICT ("project_id", "actor_id") DO UPDATE
    SET "role" = EXCLUDED."role", "status" = 'active', "invited_by_actor_id" = EXCLUDED."invited_by_actor_id",
        "joined_at" = EXCLUDED."joined_at", "removed_by_actor_id" = NULL, "removed_at" = NULL,
        "removal_reason" = NULL, "updated_at" = EXCLUDED."updated_at", "deleted_at" = NULL;
    IF reactivated THEN
      INSERT INTO "private"."admission_audit_events" (
        "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
      ) VALUES (
        'project_membership.reactivated', invitation_row.invited_actor_id, 'project_membership',
        invitation_row.project_id || ':' || invitation_row.invited_actor_id,
        pg_catalog.jsonb_build_object('role', invitation_row.role, 'invitationId', p_invitation_id), effective_now
      );
    END IF;
  END IF;

  UPDATE "private"."project_invitations"
  SET "status" = p_response, "responded_at" = effective_now, "updated_at" = effective_now
  WHERE "invitation_id" = p_invitation_id
  RETURNING * INTO invitation_row;
  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'project_invitation.' || p_response, invitation_row.invited_actor_id, 'project_invitation', p_invitation_id::text,
    pg_catalog.jsonb_build_object('projectId', invitation_row.project_id, 'role', invitation_row.role), effective_now
  );
  RETURN pg_catalog.to_jsonb(invitation_row);
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_invitation_revoke"(
  p_invitation_id uuid,
  p_revoked_by_actor_id text,
  p_reason text,
  p_revoked_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_now timestamptz := pg_catalog.clock_timestamp();
  invitation_row "private"."project_invitations"%ROWTYPE;
  revoker_role text;
BEGIN
  -- p_revoked_at is compatibility-only; lifecycle time is database-owned.
  IF p_revoked_by_actor_id IS NULL OR pg_catalog.btrim(p_revoked_by_actor_id) = ''
     OR p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_REVOCATION_INVALID] revocation reason is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO invitation_row
  FROM "private"."project_invitations"
  WHERE "invitation_id" = p_invitation_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_NOT_FOUND] invitation was not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT "role" INTO revoker_role
  FROM "public"."project_members"
  WHERE "project_id" = invitation_row.project_id
    AND "actor_id" = pg_catalog.btrim(p_revoked_by_actor_id)
    AND "status" = 'active' AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND OR revoker_role NOT IN ('owner', 'maintainer') THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_FORBIDDEN] owner or maintainer membership is required' USING ERRCODE = '42501';
  END IF;
  IF invitation_row.status <> 'pending' OR invitation_row.expires_at <= effective_now THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_STATE_INVALID] only a live pending invitation can be revoked' USING ERRCODE = '55000';
  END IF;
  UPDATE "private"."project_invitations"
  SET "status" = 'revoked', "revoked_by_actor_id" = pg_catalog.btrim(p_revoked_by_actor_id),
      "revoked_at" = effective_now, "revocation_reason" = pg_catalog.btrim(p_reason), "updated_at" = effective_now
  WHERE "invitation_id" = p_invitation_id
  RETURNING * INTO invitation_row;
  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'project_invitation.revoked', pg_catalog.btrim(p_revoked_by_actor_id), 'project_invitation', p_invitation_id::text,
    pg_catalog.jsonb_build_object('projectId', invitation_row.project_id, 'reason', pg_catalog.btrim(p_reason)), effective_now
  );
  RETURN pg_catalog.to_jsonb(invitation_row);
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_membership_change_role"(
  p_project_id text,
  p_target_actor_id text,
  p_changed_by_actor_id text,
  p_role text,
  p_reason text,
  p_changed_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changer_role text;
  target_member "public"."project_members"%ROWTYPE;
  previous_role text;
  remaining_owners integer;
BEGIN
  IF p_role IS NULL OR p_role NOT IN ('owner', 'maintainer', 'contributor', 'viewer')
     OR p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION '[PROJECT_MEMBERSHIP_ROLE_INVALID] valid role and reason are required' USING ERRCODE = '22023';
  END IF;
  -- Serialize every owner-count mutation on the stable Project row. Locking
  -- only the two membership rows lets two owners concurrently demote each
  -- other after both observe one remaining owner.
  PERFORM 1
  FROM "public"."projects"
  WHERE "project_id" = pg_catalog.btrim(p_project_id)
  FOR NO KEY UPDATE;
  SELECT "role" INTO changer_role
  FROM "public"."project_members"
  WHERE "project_id" = pg_catalog.btrim(p_project_id)
    AND "actor_id" = pg_catalog.btrim(p_changed_by_actor_id)
    AND "status" = 'active' AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND OR changer_role <> 'owner' THEN
    RAISE EXCEPTION '[PROJECT_MEMBERSHIP_FORBIDDEN] active owner membership is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target_member
  FROM "public"."project_members"
  WHERE "project_id" = pg_catalog.btrim(p_project_id)
    AND "actor_id" = pg_catalog.btrim(p_target_actor_id)
    AND "status" = 'active' AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[PROJECT_MEMBERSHIP_NOT_FOUND] active target membership was not found' USING ERRCODE = 'P0002';
  END IF;
  previous_role := target_member.role;
  IF target_member.role = 'owner' AND p_role <> 'owner' THEN
    SELECT pg_catalog.count(*) INTO remaining_owners
    FROM "public"."project_members"
    WHERE "project_id" = target_member.project_id AND "role" = 'owner' AND "status" = 'active'
      AND "deleted_at" IS NULL AND "actor_id" <> target_member.actor_id;
    IF remaining_owners = 0 THEN
      RAISE EXCEPTION '[PROJECT_MEMBERSHIP_LAST_OWNER] project must retain an active owner' USING ERRCODE = '55000';
    END IF;
  END IF;
  UPDATE "public"."project_members"
  SET "role" = p_role, "updated_at" = p_changed_at
  WHERE "project_id" = target_member.project_id AND "actor_id" = target_member.actor_id
  RETURNING * INTO target_member;
  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'project_membership.role_changed', pg_catalog.btrim(p_changed_by_actor_id), 'project_membership',
    target_member.project_id || ':' || target_member.actor_id,
    pg_catalog.jsonb_build_object('fromRole', previous_role, 'toRole', p_role, 'reason', pg_catalog.btrim(p_reason)), p_changed_at
  );
  RETURN pg_catalog.to_jsonb(target_member);
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_membership_remove"(
  p_project_id text,
  p_target_actor_id text,
  p_removed_by_actor_id text,
  p_reason text,
  p_removed_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  remover_role text;
  target_member "public"."project_members"%ROWTYPE;
  remaining_owners integer;
BEGIN
  IF p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION '[PROJECT_MEMBERSHIP_REMOVAL_INVALID] removal reason is required' USING ERRCODE = '22023';
  END IF;
  -- Share the same project-scoped lock order as role changes so concurrent
  -- demote/remove operations cannot jointly erase the final owner.
  PERFORM 1
  FROM "public"."projects"
  WHERE "project_id" = pg_catalog.btrim(p_project_id)
  FOR NO KEY UPDATE;
  SELECT "role" INTO remover_role
  FROM "public"."project_members"
  WHERE "project_id" = pg_catalog.btrim(p_project_id)
    AND "actor_id" = pg_catalog.btrim(p_removed_by_actor_id)
    AND "status" = 'active' AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND OR remover_role NOT IN ('owner', 'maintainer') THEN
    RAISE EXCEPTION '[PROJECT_MEMBERSHIP_FORBIDDEN] owner or maintainer membership is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target_member
  FROM "public"."project_members"
  WHERE "project_id" = pg_catalog.btrim(p_project_id)
    AND "actor_id" = pg_catalog.btrim(p_target_actor_id)
    AND "status" = 'active' AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[PROJECT_MEMBERSHIP_NOT_FOUND] active target membership was not found' USING ERRCODE = 'P0002';
  END IF;
  IF remover_role = 'maintainer' AND target_member.role IN ('owner', 'maintainer') THEN
    RAISE EXCEPTION '[PROJECT_MEMBERSHIP_FORBIDDEN] maintainers cannot remove owners or maintainers' USING ERRCODE = '42501';
  END IF;
  IF target_member.role = 'owner' THEN
    SELECT pg_catalog.count(*) INTO remaining_owners
    FROM "public"."project_members"
    WHERE "project_id" = target_member.project_id AND "role" = 'owner' AND "status" = 'active'
      AND "deleted_at" IS NULL AND "actor_id" <> target_member.actor_id;
    IF remaining_owners = 0 THEN
      RAISE EXCEPTION '[PROJECT_MEMBERSHIP_LAST_OWNER] project must retain an active owner' USING ERRCODE = '55000';
    END IF;
  END IF;
  UPDATE "public"."project_members"
  SET "status" = 'removed', "removed_by_actor_id" = pg_catalog.btrim(p_removed_by_actor_id),
      "removed_at" = p_removed_at, "removal_reason" = pg_catalog.btrim(p_reason),
      "updated_at" = p_removed_at, "deleted_at" = p_removed_at
  WHERE "project_id" = target_member.project_id AND "actor_id" = target_member.actor_id
  RETURNING * INTO target_member;
  INSERT INTO "private"."admission_audit_events" (
    "event_type", "actor_id", "subject_type", "subject_id", "details", "occurred_at"
  ) VALUES (
    'project_membership.removed', pg_catalog.btrim(p_removed_by_actor_id), 'project_membership',
    target_member.project_id || ':' || target_member.actor_id,
    pg_catalog.jsonb_build_object('role', target_member.role, 'reason', pg_catalog.btrim(p_reason)), p_removed_at
  );
  RETURN pg_catalog.to_jsonb(target_member);
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION "private"."prevent_admission_audit_event_mutation"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."decode_canonical_ed25519_spki"(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."prepare_signing_key"() FROM PUBLIC;--> statement-breakpoint

DO $admission_function_grants$
DECLARE
  function_signature text;
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.actor_onboarding_complete(text,text,text,timestamp with time zone,text,text,text)',
    'public.signing_key_list(text)',
    'public.signing_key_register(text,text,text,text,timestamp with time zone)',
    'public.signing_key_revoke(text,text,text,timestamp with time zone)',
    'public.project_application_submit(text,text,text,text,text,timestamp with time zone)',
    'public.project_application_withdraw(uuid,text,timestamp with time zone)',
    'public.project_application_decide(uuid,text,text,text,timestamp with time zone)',
    'public.project_invitation_create(text,text,text,text,timestamp with time zone,timestamp with time zone)',
    'public.project_invitation_respond(uuid,text,text,timestamp with time zone)',
    'public.project_invitation_revoke(uuid,text,text,timestamp with time zone)',
    'public.project_membership_change_role(text,text,text,text,text,timestamp with time zone)',
    'public.project_membership_remove(text,text,text,text,timestamp with time zone)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', function_signature);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', function_signature);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', function_signature);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', function_signature);
    END IF;
  END LOOP;
END
$admission_function_grants$;
