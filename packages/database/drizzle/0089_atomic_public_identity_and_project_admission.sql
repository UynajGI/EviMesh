-- Public-product identity and project admission are service-owned atomic
-- operations. Browser sessions never assemble verified identities or create a
-- Project one table at a time.

ALTER TABLE "public"."identities" ADD COLUMN "verification_source" text;--> statement-breakpoint
ALTER TABLE "public"."identities" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "public"."identities" ADD CONSTRAINT "identities_verification_shape" CHECK (
  ("verified_at" IS NULL AND "verification_source" IS NULL)
  OR ("verified_at" IS NOT NULL AND "verification_source" = 'supabase_auth')
);--> statement-breakpoint
CREATE INDEX "identities_actor_verified_idx" ON "public"."identities" USING btree ("actor_id","verified_at")
  WHERE "verified_at" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint

ALTER TABLE "private"."admission_audit_events"
  DROP CONSTRAINT "admission_audit_events_type_allowed";--> statement-breakpoint
ALTER TABLE "private"."admission_audit_events"
  ADD CONSTRAINT "admission_audit_events_type_allowed" CHECK (
    "event_type" in (
      'actor.bootstrapped', 'identity.linked',
      'onboarding.completed', 'signing_key.registered', 'signing_key.revoked',
      'project_application.submitted', 'project_application.withdrawn',
      'project_application.approved', 'project_application.rejected',
      'project_invitation.created', 'project_invitation.accepted',
      'project_invitation.declined', 'project_invitation.expired',
      'project_invitation.revoked', 'project_membership.role_changed',
      'project_membership.removed', 'project_membership.reactivated'
    )
  );--> statement-breakpoint
ALTER TABLE "private"."admission_audit_events"
  DROP CONSTRAINT "admission_audit_events_subject_type_allowed";--> statement-breakpoint
ALTER TABLE "private"."admission_audit_events"
  ADD CONSTRAINT "admission_audit_events_subject_type_allowed" CHECK (
    "subject_type" in ('actor', 'identity', 'signing_key', 'project_application', 'project_invitation', 'project_membership')
  );--> statement-breakpoint

ALTER TABLE "private"."admission_feature_gates"
  DROP CONSTRAINT "admission_feature_gates_name_allowed";--> statement-breakpoint
ALTER TABLE "private"."admission_feature_gates"
  ADD CONSTRAINT "admission_feature_gates_name_allowed" CHECK (
    "gate" in ('project_approval_graph_write', 'atomic_public_identity_and_project_admission')
  );--> statement-breakpoint
INSERT INTO "private"."admission_feature_gates" ("gate", "enabled", "updated_by")
VALUES ('atomic_public_identity_and_project_admission', true, '0089_atomic_public_identity_and_project_admission')
ON CONFLICT ("gate") DO UPDATE
SET "enabled" = EXCLUDED."enabled", "updated_by" = EXCLUDED."updated_by", "updated_at" = pg_catalog.transaction_timestamp();--> statement-breakpoint

CREATE TABLE "private"."project_application_decision_receipts" (
  "receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL,
  "decision" text NOT NULL,
  "reason" text NOT NULL,
  "steward_actor_id" text NOT NULL,
  "platform_actor_id" text NOT NULL,
  "event_id" text NOT NULL,
  "event_hash" text NOT NULL,
  "platform_event" jsonb NOT NULL,
  "result" jsonb NOT NULL,
  "decided_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_application_decision_receipts_application_unique" UNIQUE ("application_id"),
  CONSTRAINT "project_application_decision_receipts_event_unique" UNIQUE ("event_id"),
  CONSTRAINT "project_application_decision_receipts_decision_allowed" CHECK ("decision" in ('approved','rejected')),
  CONSTRAINT "project_application_decision_receipts_reason_length" CHECK (pg_catalog.char_length("reason") between 1 and 1000),
  CONSTRAINT "project_application_decision_receipts_event_hash" CHECK ("event_hash" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "project_application_decision_receipts_event_object" CHECK (pg_catalog.jsonb_typeof("platform_event") = 'object'),
  CONSTRAINT "project_application_decision_receipts_result_object" CHECK (pg_catalog.jsonb_typeof("result") = 'object')
);--> statement-breakpoint
ALTER TABLE "private"."project_application_decision_receipts" ADD CONSTRAINT "project_application_decision_receipts_application_fk"
  FOREIGN KEY ("application_id") REFERENCES "private"."project_applications"("application_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_application_decision_receipts" ADD CONSTRAINT "project_application_decision_receipts_steward_fk"
  FOREIGN KEY ("steward_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_application_decision_receipts" ADD CONSTRAINT "project_application_decision_receipts_platform_actor_fk"
  FOREIGN KEY ("platform_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."project_application_decision_receipts" ADD CONSTRAINT "project_application_decision_receipts_event_fk"
  FOREIGN KEY ("event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_application_decision_receipts_steward_time_idx"
  ON "private"."project_application_decision_receipts" USING btree ("steward_actor_id","decided_at");--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."prevent_project_application_decision_receipt_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '[PROJECT_APPLICATION_DECISION_RECEIPT_IMMUTABLE] decision receipts are append-only'
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "project_application_decision_receipts_append_only_trigger"
BEFORE UPDATE OR DELETE ON "private"."project_application_decision_receipts"
FOR EACH ROW EXECUTE FUNCTION "private"."prevent_project_application_decision_receipt_mutation"();--> statement-breakpoint
ALTER TABLE "private"."project_application_decision_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "private"."project_application_decision_receipts" FROM PUBLIC;--> statement-breakpoint

-- ISO 7064 MOD 11-2. Only an ORCID subject obtained from the Custom OIDC
-- identity array may reach the bootstrap insert, and it must still be a valid
-- canonical iD.
CREATE OR REPLACE FUNCTION "private"."orcid_is_valid"(p_orcid text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_compact text;
  v_total integer := 0;
  v_index integer;
  v_remainder integer;
  v_check text;
BEGIN
  IF p_orcid !~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$' THEN
    RETURN false;
  END IF;
  v_compact := pg_catalog.replace(p_orcid, '-', '');
  FOR v_index IN 1..15 LOOP
    v_total := (v_total + pg_catalog.substr(v_compact, v_index, 1)::integer) * 2;
  END LOOP;
  v_remainder := (12 - (v_total % 11)) % 11;
  v_check := CASE WHEN v_remainder = 10 THEN 'X' ELSE v_remainder::text END;
  RETURN v_check = pg_catalog.substr(v_compact, 16, 1);
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."actor_self_bootstrap"(p_authoritative_claims jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_subject text;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_actor_by_subject text;
  v_actor_by_identity text;
  v_actor_id text;
  v_actor_type text;
  v_actor_created boolean := false;
  v_identity jsonb;
  v_provider text;
  v_subject text;
  v_identity_email text;
  v_verified_at timestamptz;
  v_existing_identity record;
  v_identity_created boolean;
  v_verified_identities jsonb;
BEGIN
  IF pg_catalog.jsonb_typeof(p_authoritative_claims) IS DISTINCT FROM 'object'
     OR p_authoritative_claims->>'schema' IS DISTINCT FROM 'evimesh.auth-bootstrap-claims.v1'
     OR p_authoritative_claims->>'source' IS DISTINCT FROM 'supabase_auth_admin'
     OR pg_catalog.jsonb_typeof(p_authoritative_claims->'identities') IS DISTINCT FROM 'array'
     OR (p_authoritative_claims - ARRAY['schema','source','authSubject','email','emailConfirmedAt','identities']::text[]) <> '{}'::jsonb THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_CLAIMS_INVALID] normalized Supabase Auth admin claims are required'
      USING ERRCODE = '22023';
  END IF;

  v_auth_subject := pg_catalog.btrim(p_authoritative_claims->>'authSubject');
  v_email := pg_catalog.lower(pg_catalog.btrim(p_authoritative_claims->>'email'));
  IF v_auth_subject IS NULL
     OR v_auth_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR v_email IS NULL OR pg_catalog.char_length(v_email) NOT BETWEEN 3 AND 320
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
     OR NULLIF(p_authoritative_claims->>'emailConfirmedAt','') IS NULL THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_EMAIL_NOT_VERIFIED] a confirmed authoritative Supabase email is required'
      USING ERRCODE = '42501';
  END IF;
  BEGIN
    v_email_confirmed_at := (p_authoritative_claims->>'emailConfirmedAt')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_CLAIMS_INVALID] email confirmation timestamp is invalid'
      USING ERRCODE = '22023';
  END;
  IF v_email_confirmed_at > pg_catalog.transaction_timestamp() + interval '5 minutes' THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_CLAIMS_INVALID] email confirmation timestamp is in the future'
      USING ERRCODE = '22023';
  END IF;

  -- Validate the whole authoritative identity set before any row is created.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_authoritative_claims->'identities') AS item(value)
    WHERE pg_catalog.jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR (item.value - ARRAY['provider','subject','email','verifiedAt']::text[]) <> '{}'::jsonb
       OR item.value->>'provider' NOT IN ('github','google','custom:orcid')
       OR NULLIF(pg_catalog.btrim(item.value->>'subject'),'') IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(item.value->>'subject')) > 500
       OR NULLIF(item.value->>'verifiedAt','') IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_authoritative_claims->'identities') AS item(value)
    GROUP BY item.value->>'provider', pg_catalog.btrim(item.value->>'subject')
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_IDENTITY_INVALID] only unique GitHub, Google, and custom:orcid Auth identities are accepted'
      USING ERRCODE = '22023';
  END IF;

  FOR v_identity IN
    SELECT item.value
    FROM pg_catalog.jsonb_array_elements(p_authoritative_claims->'identities') AS item(value)
    ORDER BY item.value->>'provider', pg_catalog.btrim(item.value->>'subject')
  LOOP
    v_provider := v_identity->>'provider';
    v_subject := pg_catalog.btrim(v_identity->>'subject');
    IF v_provider = 'custom:orcid' AND NOT "private"."orcid_is_valid"(v_subject) THEN
      RAISE EXCEPTION '[ACTOR_BOOTSTRAP_ORCID_INVALID] custom:orcid subject must be a valid canonical ORCID iD'
        USING ERRCODE = '22023';
    END IF;
    IF NULLIF(v_identity->>'email','') IS NOT NULL
       AND (pg_catalog.char_length(pg_catalog.btrim(v_identity->>'email')) > 320
            OR pg_catalog.btrim(v_identity->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+$') THEN
      RAISE EXCEPTION '[ACTOR_BOOTSTRAP_IDENTITY_INVALID] linked identity email is invalid'
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_verified_at := (v_identity->>'verifiedAt')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '[ACTOR_BOOTSTRAP_IDENTITY_INVALID] linked identity verification timestamp is invalid'
        USING ERRCODE = '22023';
    END;
    IF v_verified_at > pg_catalog.transaction_timestamp() + interval '5 minutes' THEN
      RAISE EXCEPTION '[ACTOR_BOOTSTRAP_IDENTITY_INVALID] linked identity verification timestamp is in the future'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('actor-auth:' || v_auth_subject, 0));
  FOR v_identity IN
    SELECT item.value
    FROM pg_catalog.jsonb_array_elements(p_authoritative_claims->'identities') AS item(value)
    ORDER BY item.value->>'provider', pg_catalog.btrim(item.value->>'subject')
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'identity:' || (v_identity->>'provider') || ':' || pg_catalog.btrim(v_identity->>'subject'), 0
    ));
  END LOOP;

  SELECT actor."actor_id" INTO v_actor_by_subject
  FROM "public"."actors" AS actor
  WHERE actor."auth_subject" = v_auth_subject
  FOR NO KEY UPDATE;

  SELECT identity."actor_id" INTO v_actor_by_identity
  FROM "public"."identities" AS identity
  WHERE identity."provider" = 'supabase' AND identity."subject" = v_auth_subject
  FOR NO KEY UPDATE;

  IF v_actor_by_subject IS NOT NULL AND v_actor_by_identity IS NOT NULL
     AND v_actor_by_subject IS DISTINCT FROM v_actor_by_identity THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_BINDING_CONFLICT] auth subject Actor and Supabase identity disagree'
      USING ERRCODE = 'P0001';
  END IF;
  v_actor_id := COALESCE(v_actor_by_subject, v_actor_by_identity);
  IF v_actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "public"."actors" AS actor
    WHERE actor."actor_id" = v_actor_id
      AND actor."auth_subject" = v_auth_subject
      AND actor."actor_type" IN ('human','maintainer')
      AND actor."deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_BINDING_CONFLICT] active Human Actor binding is inconsistent'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_actor_by_identity IS NOT NULL AND EXISTS (
    SELECT 1 FROM "public"."identities" AS identity
    WHERE identity."provider" = 'supabase' AND identity."subject" = v_auth_subject
      AND identity."deleted_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_BINDING_CONFLICT] revoked Supabase identity cannot be silently restored'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_actor_id IS NULL THEN
    v_actor_id := 'actor_' || pg_catalog.gen_random_uuid()::text;
  END IF;

  -- Preflight every linked identity against the chosen Actor. This check is
  -- performed before the Actor insert so a provider collision cannot orphan a
  -- newly generated Actor even if a caller races another Auth subject.
  FOR v_identity IN
    SELECT item.value
    FROM pg_catalog.jsonb_array_elements(p_authoritative_claims->'identities') AS item(value)
    ORDER BY item.value->>'provider', pg_catalog.btrim(item.value->>'subject')
  LOOP
    SELECT identity."actor_id", identity."deleted_at" INTO v_existing_identity
    FROM "public"."identities" AS identity
    WHERE identity."provider" = v_identity->>'provider'
      AND identity."subject" = pg_catalog.btrim(v_identity->>'subject')
    FOR NO KEY UPDATE;
    IF FOUND AND (v_existing_identity."actor_id" IS DISTINCT FROM v_actor_id
                  OR v_existing_identity."deleted_at" IS NOT NULL) THEN
      RAISE EXCEPTION '[ACTOR_BOOTSTRAP_IDENTITY_CONFLICT] provider subject already belongs to another or revoked identity'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  IF v_actor_by_subject IS NULL AND v_actor_by_identity IS NULL THEN
    INSERT INTO "public"."actors" (
      "actor_id","actor_type","identity_strength","auth_subject","created_at","updated_at"
    ) VALUES (
      v_actor_id,'human','verified',v_auth_subject,pg_catalog.transaction_timestamp(),pg_catalog.transaction_timestamp()
    );
    v_actor_created := true;
    INSERT INTO "private"."admission_audit_events" (
      "event_type","actor_id","subject_type","subject_id","details","occurred_at"
    ) VALUES (
      'actor.bootstrapped',v_actor_id,'actor',v_actor_id,
      pg_catalog.jsonb_build_object('source','supabase_auth_admin','authSubject',v_auth_subject),
      pg_catalog.transaction_timestamp()
    );
  ELSE
    UPDATE "public"."actors"
    SET "identity_strength" = 'verified', "updated_at" = pg_catalog.transaction_timestamp()
    WHERE "actor_id" = v_actor_id;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM "public"."identities"
    WHERE "provider"='supabase' AND "subject"=v_auth_subject
  ) INTO v_identity_created;
  INSERT INTO "public"."identities" (
    "actor_id","provider","subject","email","verification_source","verified_at","created_at","updated_at","deleted_at"
  ) VALUES (
    v_actor_id,'supabase',v_auth_subject,v_email,'supabase_auth',v_email_confirmed_at,
    pg_catalog.transaction_timestamp(),pg_catalog.transaction_timestamp(),NULL
  )
  ON CONFLICT ("provider","subject") DO UPDATE
  SET "email"=EXCLUDED."email", "verification_source"='supabase_auth',
      "verified_at"=LEAST("identities"."verified_at",EXCLUDED."verified_at"),
      "updated_at"=pg_catalog.transaction_timestamp()
  WHERE "identities"."actor_id"=EXCLUDED."actor_id" AND "identities"."deleted_at" IS NULL;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."identities"
    WHERE "provider"='supabase' AND "subject"=v_auth_subject
      AND "actor_id"=v_actor_id AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_BINDING_CONFLICT] Supabase identity insert did not preserve exact Actor ownership'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_identity_created THEN
    INSERT INTO "private"."admission_audit_events" (
      "event_type","actor_id","subject_type","subject_id","details","occurred_at"
    ) SELECT
      'identity.linked',v_actor_id,'identity',identity."identity_id"::text,
      pg_catalog.jsonb_build_object('provider','supabase','verificationSource','supabase_auth','verifiedAt',v_email_confirmed_at),
      pg_catalog.transaction_timestamp()
    FROM "public"."identities" AS identity
    WHERE identity."provider"='supabase' AND identity."subject"=v_auth_subject;
  END IF;

  FOR v_identity IN
    SELECT item.value
    FROM pg_catalog.jsonb_array_elements(p_authoritative_claims->'identities') AS item(value)
    ORDER BY item.value->>'provider', pg_catalog.btrim(item.value->>'subject')
  LOOP
    v_provider := v_identity->>'provider';
    v_subject := pg_catalog.btrim(v_identity->>'subject');
    v_identity_email := pg_catalog.lower(NULLIF(pg_catalog.btrim(v_identity->>'email'),''));
    v_verified_at := (v_identity->>'verifiedAt')::timestamptz;
    SELECT NOT EXISTS (
      SELECT 1 FROM "public"."identities"
      WHERE "provider"=v_provider AND "subject"=v_subject
    ) INTO v_identity_created;
    INSERT INTO "public"."identities" (
      "actor_id","provider","subject","email","verification_source","verified_at","created_at","updated_at","deleted_at"
    ) VALUES (
      v_actor_id,v_provider,v_subject,v_identity_email,'supabase_auth',v_verified_at,
      pg_catalog.transaction_timestamp(),pg_catalog.transaction_timestamp(),NULL
    )
    ON CONFLICT ("provider","subject") DO UPDATE
    SET "email"=COALESCE(EXCLUDED."email","identities"."email"),
        "verification_source"='supabase_auth',
        "verified_at"=LEAST("identities"."verified_at",EXCLUDED."verified_at"),
        "updated_at"=pg_catalog.transaction_timestamp()
    WHERE "identities"."actor_id"=EXCLUDED."actor_id" AND "identities"."deleted_at" IS NULL;
    IF NOT EXISTS (
      SELECT 1 FROM "public"."identities"
      WHERE "provider"=v_provider AND "subject"=v_subject
        AND "actor_id"=v_actor_id AND "deleted_at" IS NULL
        AND "verification_source"='supabase_auth' AND "verified_at" IS NOT NULL
    ) THEN
      RAISE EXCEPTION '[ACTOR_BOOTSTRAP_IDENTITY_CONFLICT] linked Auth identity did not preserve exact Actor ownership'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_identity_created THEN
      INSERT INTO "private"."admission_audit_events" (
        "event_type","actor_id","subject_type","subject_id","details","occurred_at"
      ) SELECT
        'identity.linked',v_actor_id,'identity',identity."identity_id"::text,
        pg_catalog.jsonb_build_object('provider',v_provider,'verificationSource','supabase_auth','verifiedAt',v_verified_at),
        pg_catalog.transaction_timestamp()
      FROM "public"."identities" AS identity
      WHERE identity."provider"=v_provider AND identity."subject"=v_subject;
    END IF;
  END LOOP;

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'provider',identity."provider",'subject',identity."subject",
      'email',identity."email",'verifiedAt',identity."verified_at",
      'verificationSource',identity."verification_source"
    ) ORDER BY identity."provider",identity."subject"
  ),'[]'::jsonb) INTO v_verified_identities
  FROM "public"."identities" AS identity
  WHERE identity."actor_id"=v_actor_id AND identity."deleted_at" IS NULL
    AND identity."verification_source"='supabase_auth' AND identity."verified_at" IS NOT NULL;

  SELECT actor."actor_type"::text INTO STRICT v_actor_type
  FROM "public"."actors" AS actor WHERE actor."actor_id"=v_actor_id;

  RETURN pg_catalog.jsonb_build_object(
    'schema','evimesh.actor-bootstrap-result.v1',
    'actorId',v_actor_id,
    'actorType',v_actor_type,
    'identityStrength','verified',
    'created',v_actor_created,
    'email',v_email,
    'emailConfirmedAt',v_email_confirmed_at,
    'identities',v_verified_identities
  );
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION '[ACTOR_BOOTSTRAP_IDENTITY_CONFLICT] concurrent identity ownership conflict'
    USING ERRCODE = 'P0001';
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."actor_self_bootstrap"(p_authoritative_claims jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'service_role'
     AND COALESCE(pg_catalog.current_setting('request.jwt.claim.role',true),'') <> 'service_role' THEN
    RAISE EXCEPTION '[ACTOR_BOOTSTRAP_SERVICE_ROLE_REQUIRED] service role is required'
      USING ERRCODE = '42501';
  END IF;
  RETURN "private"."actor_self_bootstrap"(p_authoritative_claims);
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."project_application_decide_atomic"(
  p_application_id uuid,
  p_steward_actor_id text,
  p_decision text,
  p_reason text,
  p_decided_at timestamptz,
  p_platform_actor_id text,
  p_platform_event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_application "private"."project_applications"%ROWTYPE;
  v_receipt "private"."project_application_decision_receipts"%ROWTYPE;
  v_payload jsonb;
  v_event_id text;
  v_event_hash text;
  v_event_created_at timestamptz;
  v_project_content jsonb;
  v_source_payload jsonb;
  v_result jsonb;
BEGIN
  IF p_application_id IS NULL
     OR NULLIF(pg_catalog.btrim(p_steward_actor_id),'') IS NULL
     OR p_decision NOT IN ('approved','rejected')
     OR p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 1000
     OR p_decided_at IS NULL
     OR NULLIF(pg_catalog.btrim(p_platform_actor_id),'') IS NULL THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_DECISION_INVALID] complete approved/rejected decision input is required'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('project-application:' || p_application_id::text,0));
  SELECT * INTO v_application
  FROM "private"."project_applications"
  WHERE "application_id"=p_application_id
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_NOT_FOUND] application was not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_receipt
  FROM "private"."project_application_decision_receipts"
  WHERE "application_id"=p_application_id
  FOR NO KEY UPDATE;
  IF FOUND THEN
    IF v_receipt."decision" IS DISTINCT FROM p_decision
       OR v_receipt."reason" IS DISTINCT FROM pg_catalog.btrim(p_reason)
       OR v_receipt."steward_actor_id" IS DISTINCT FROM pg_catalog.btrim(p_steward_actor_id)
       OR v_receipt."platform_actor_id" IS DISTINCT FROM pg_catalog.btrim(p_platform_actor_id)
       OR v_receipt."decided_at" IS DISTINCT FROM p_decided_at
       OR v_receipt."platform_event" IS DISTINCT FROM p_platform_event THEN
      RAISE EXCEPTION '[PROJECT_APPLICATION_DECISION_REPLAY_CONFLICT] application already binds a different immutable decision'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN v_receipt."result";
  END IF;
  IF v_application."status" <> 'pending' THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_STATE_CONFLICT] application was decided outside the atomic decision contract'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_decided_at < v_application."submitted_at"
     OR p_decided_at > pg_catalog.transaction_timestamp() + interval '5 minutes' THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_DECISION_INVALID] decision timestamp is outside the application lifecycle'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors" AS steward
    WHERE steward."actor_id"=pg_catalog.btrim(p_steward_actor_id)
      AND steward."actor_type"='maintainer'
      AND steward."terms_accepted_at" IS NOT NULL
      AND steward."profile_completed_at" IS NOT NULL
      AND steward."deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_STEWARD_FORBIDDEN] active community steward is required'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors" AS applicant
    WHERE applicant."actor_id"=v_application."applicant_actor_id"
      AND applicant."actor_type" IN ('human','maintainer')
      AND applicant."terms_accepted_at" IS NOT NULL
      AND applicant."profile_completed_at" IS NOT NULL
      AND applicant."deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_APPLICANT_INACTIVE] applicant is no longer an active onboarded Human'
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors" AS platform
    WHERE platform."actor_id"=pg_catalog.btrim(p_platform_actor_id)
      AND platform."actor_type"='service' AND platform."deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_PLATFORM_ACTOR_INVALID] active platform service Actor is required'
      USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.jsonb_typeof(p_platform_event) IS DISTINCT FROM 'object'
     OR p_platform_event->>'schema' IS DISTINCT FROM 'srp.event.v1'
     OR COALESCE(p_platform_event->>'eventId',p_platform_event->>'event_id') IS NULL
     OR COALESCE(p_platform_event->>'eventType',p_platform_event->>'event_type') IS DISTINCT FROM 'governance.project_application_decided'
     OR pg_catalog.jsonb_typeof(p_platform_event->'payload') IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_platform_event->'signature') IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(p_platform_event->'parents') IS DISTINCT FROM 'array'
     OR p_platform_event->'signature'->>'algorithm' IS DISTINCT FROM 'Ed25519'
     OR NULLIF(p_platform_event->'signature'->>'key_id','') IS NULL
     OR NULLIF(p_platform_event->'signature'->>'value','') IS NULL THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_PLATFORM_EVENT_INVALID] complete API-verified platform ResearchEvent is required'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "public"."signing_keys" AS human_key
    WHERE human_key."key_id"=p_platform_event->'signature'->>'key_id'
  ) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_PLATFORM_KEY_INVALID] platform governance key must not be a Human signing key'
      USING ERRCODE = '22023';
  END IF;
  v_payload := p_platform_event->'payload';
  IF (v_payload - ARRAY[
       'schema','actor_id','signer_semantics','human_signature','application_id',
       'steward_actor_id','applicant_actor_id','decision','reason','project_id',
       'project_revision','project_name','project_summary','project_license','decided_at'
     ]::text[]) <> '{}'::jsonb
     OR v_payload->>'schema' IS DISTINCT FROM 'evimesh.project-application-decision.v1'
     OR v_payload->>'actor_id' IS DISTINCT FROM pg_catalog.btrim(p_platform_actor_id)
     OR v_payload->>'signer_semantics' IS DISTINCT FROM 'platform_governance'
     OR v_payload->'human_signature' IS DISTINCT FROM 'false'::jsonb
     OR v_payload->>'application_id' IS DISTINCT FROM p_application_id::text
     OR v_payload->>'steward_actor_id' IS DISTINCT FROM pg_catalog.btrim(p_steward_actor_id)
     OR v_payload->>'applicant_actor_id' IS DISTINCT FROM v_application."applicant_actor_id"
     OR v_payload->>'decision' IS DISTINCT FROM p_decision
     OR v_payload->>'reason' IS DISTINCT FROM pg_catalog.btrim(p_reason)
     OR v_payload->>'project_id' IS DISTINCT FROM v_application."proposed_project_id"
     OR v_payload->>'project_name' IS DISTINCT FROM v_application."proposed_name"
     OR v_payload->>'project_summary' IS DISTINCT FROM v_application."proposed_summary"
     OR v_payload->>'project_license' IS DISTINCT FROM v_application."proposed_license"
     OR (v_payload->>'decided_at')::timestamptz IS DISTINCT FROM p_decided_at
     OR (p_decision='approved' AND v_payload->'project_revision' IS DISTINCT FROM '1'::jsonb)
     OR (p_decision='rejected' AND v_payload->'project_revision' IS DISTINCT FROM 'null'::jsonb) THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_PLATFORM_EVENT_MISMATCH] event does not bind the exact application, decision, Actors, and Project content'
      USING ERRCODE = 'P0001';
  END IF;

  v_event_id := "private"."persist_verified_research_event"(
    p_platform_event,'governance.project_application_decided',pg_catalog.btrim(p_platform_actor_id)
  );
  SELECT event."hash",event."created_at" INTO STRICT v_event_hash,v_event_created_at
  FROM "public"."research_events" AS event WHERE event."event_id"=v_event_id;

  IF p_decision='approved' THEN
    IF EXISTS (SELECT 1 FROM "public"."projects" WHERE "project_id"=v_application."proposed_project_id")
       OR EXISTS (SELECT 1 FROM "private"."research_nodes" WHERE "node_id"=v_application."proposed_project_id") THEN
      RAISE EXCEPTION '[PROJECT_APPLICATION_PROJECT_CONFLICT] proposed Project or Graph identity already exists'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO "public"."projects" (
      "project_id","state","name","summary","created_by","license","created_at","updated_at","deleted_at"
    ) VALUES (
      v_application."proposed_project_id",'active',v_application."proposed_name",v_application."proposed_summary",
      pg_catalog.btrim(p_platform_actor_id),v_application."proposed_license",p_decided_at,p_decided_at,NULL
    );
    INSERT INTO "public"."project_revisions" (
      "project_id","revision","supersedes","state","name","summary","created_by","maintainer_ids","license","created_at"
    ) VALUES (
      v_application."proposed_project_id",1,NULL,'active',v_application."proposed_name",v_application."proposed_summary",
      pg_catalog.btrim(p_platform_actor_id),pg_catalog.jsonb_build_array(v_application."applicant_actor_id"),
      v_application."proposed_license",p_decided_at
    );
    v_project_content := pg_catalog.jsonb_build_object(
      'projectId',v_application."proposed_project_id",'revision',1,'state','active',
      'name',v_application."proposed_name",'summary',v_application."proposed_summary",
      'license',v_application."proposed_license",'proposedByActorId',v_application."applicant_actor_id",
      'approvedByStewardActorId',pg_catalog.btrim(p_steward_actor_id),
      'publishedByPlatformActorId',pg_catalog.btrim(p_platform_actor_id)
    );
    v_source_payload := pg_catalog.jsonb_build_object(
      'legacyProject',pg_catalog.jsonb_build_object(
        'projectId',v_application."proposed_project_id",'state','active','name',v_application."proposed_name",
        'summary',v_application."proposed_summary",'createdBy',pg_catalog.btrim(p_platform_actor_id),
        'license',v_application."proposed_license"
      ),
      'legacyRevision',v_project_content,
      'applicationId',p_application_id,
      'platformEventId',v_event_id
    );
    PERFORM "private"."insert_research_graph_dual_write_node"(
      'project'::"private"."research_node_kind",v_application."proposed_project_id",1,
      v_application."proposed_project_id",pg_catalog.btrim(p_platform_actor_id),v_event_id,v_event_hash,p_decided_at,
      v_application."proposed_name",'published'::"private"."research_document_state",
      '/projects/'||v_application."proposed_project_id",v_project_content,v_source_payload
    );
    INSERT INTO "public"."project_members" (
      "project_id","actor_id","role","status","invited_by_actor_id","joined_at","created_at","updated_at","deleted_at"
    ) VALUES (
      v_application."proposed_project_id",v_application."applicant_actor_id",'owner','active',
      pg_catalog.btrim(p_steward_actor_id),p_decided_at,p_decided_at,p_decided_at,NULL
    );
    UPDATE "private"."project_applications"
    SET "status"='approved',"decided_by_actor_id"=pg_catalog.btrim(p_steward_actor_id),
        "decided_at"=p_decided_at,"decision_reason"=pg_catalog.btrim(p_reason),
        "approved_project_id"=v_application."proposed_project_id","updated_at"=p_decided_at
    WHERE "application_id"=p_application_id;
    v_result := pg_catalog.jsonb_build_object(
      'schema','evimesh.project-application-decision-result.v1','applicationId',p_application_id,
      'status','approved','projectId',v_application."proposed_project_id",'projectRevision',1,
      'node',pg_catalog.jsonb_build_object('kind','project','id',v_application."proposed_project_id",'revision',1),
      'eventId',v_event_id,'decidedAt',p_decided_at,'stewardActorId',pg_catalog.btrim(p_steward_actor_id),
      'platformActorId',pg_catalog.btrim(p_platform_actor_id)
    );
  ELSE
    UPDATE "private"."project_applications"
    SET "status"='rejected',"decided_by_actor_id"=pg_catalog.btrim(p_steward_actor_id),
        "decided_at"=p_decided_at,"decision_reason"=pg_catalog.btrim(p_reason),
        "approved_project_id"=NULL,"updated_at"=p_decided_at
    WHERE "application_id"=p_application_id;
    v_result := pg_catalog.jsonb_build_object(
      'schema','evimesh.project-application-decision-result.v1','applicationId',p_application_id,
      'status','rejected','projectId',NULL,'projectRevision',NULL,'node',NULL,
      'eventId',v_event_id,'decidedAt',p_decided_at,'stewardActorId',pg_catalog.btrim(p_steward_actor_id),
      'platformActorId',pg_catalog.btrim(p_platform_actor_id)
    );
  END IF;

  INSERT INTO "private"."admission_audit_events" (
    "event_type","actor_id","subject_type","subject_id","details","occurred_at"
  ) VALUES (
    'project_application.'||p_decision,pg_catalog.btrim(p_steward_actor_id),'project_application',p_application_id::text,
    pg_catalog.jsonb_build_object(
      'reason',pg_catalog.btrim(p_reason),'platformEventId',v_event_id,
      'platformActorId',pg_catalog.btrim(p_platform_actor_id),
      'signerSemantics','platform_governance','humanSignature',false
    ),p_decided_at
  );
  INSERT INTO "private"."project_application_decision_receipts" (
    "application_id","decision","reason","steward_actor_id","platform_actor_id",
    "event_id","event_hash","platform_event","result","decided_at","created_at"
  ) VALUES (
    p_application_id,p_decision,pg_catalog.btrim(p_reason),pg_catalog.btrim(p_steward_actor_id),
    pg_catalog.btrim(p_platform_actor_id),v_event_id,v_event_hash,p_platform_event,v_result,p_decided_at,v_event_created_at
  );
  RETURN v_result;
EXCEPTION
  WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_PLATFORM_EVENT_INVALID] event decision timestamp is invalid'
      USING ERRCODE = '22023';
  WHEN unique_violation THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_PROJECT_CONFLICT] concurrent Project, event, membership, or receipt conflict'
      USING ERRCODE = 'P0001';
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."project_application_decide_atomic"(
  p_application_id uuid,
  p_steward_actor_id text,
  p_decision text,
  p_reason text,
  p_decided_at timestamptz,
  p_platform_actor_id text,
  p_platform_event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'service_role'
     AND COALESCE(pg_catalog.current_setting('request.jwt.claim.role',true),'') <> 'service_role' THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_DECISION_SERVICE_ROLE_REQUIRED] service role is required'
      USING ERRCODE = '42501';
  END IF;
  RETURN "private"."project_application_decide_atomic"(
    p_application_id,p_steward_actor_id,p_decision,p_reason,p_decided_at,p_platform_actor_id,p_platform_event
  );
END;
$$;--> statement-breakpoint

-- Remove the legacy five-argument decision path from the hosted role. It has
-- no platform event parameter and therefore cannot meet the public-product
-- attribution contract, even for a rejection.
REVOKE ALL ON FUNCTION "public"."project_application_decide"(uuid,text,text,text,timestamp with time zone) FROM "service_role";--> statement-breakpoint

DROP POLICY IF EXISTS "actors_insert_self" ON "public"."actors";--> statement-breakpoint
DROP POLICY IF EXISTS "identities_own_subject" ON "public"."identities";--> statement-breakpoint
CREATE POLICY "identities_own_subject_select" ON "public"."identities"
  FOR SELECT TO "authenticated"
  USING (
    "provider"='supabase' AND "subject"=(SELECT auth.uid())::text
    AND "deleted_at" IS NULL
  );--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "public"."actors" FROM "authenticated";--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "public"."identities" FROM "authenticated";--> statement-breakpoint

REVOKE ALL ON FUNCTION "private"."prevent_project_application_decision_receipt_mutation"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."orcid_is_valid"(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."actor_self_bootstrap"(jsonb) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."actor_self_bootstrap"(jsonb) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."project_application_decide_atomic"(uuid,text,text,text,timestamp with time zone,text,jsonb) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."project_application_decide_atomic"(uuid,text,text,text,timestamp with time zone,text,jsonb) FROM PUBLIC;--> statement-breakpoint

DO $atomic_public_admission_acl$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
      EXECUTE pg_catalog.format('REVOKE ALL ON TABLE private.project_application_decision_receipts FROM %I',role_name);
    END IF;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
      EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION public.actor_self_bootstrap(jsonb) FROM %I',role_name);
      EXECUTE pg_catalog.format(
        'REVOKE ALL ON FUNCTION public.project_application_decide_atomic(uuid,text,text,text,timestamp with time zone,text,jsonb) FROM %I',
        role_name
      );
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
    GRANT EXECUTE ON FUNCTION "private"."actor_self_bootstrap"(jsonb) TO "service_role";
    GRANT EXECUTE ON FUNCTION "public"."actor_self_bootstrap"(jsonb) TO "service_role";
    GRANT EXECUTE ON FUNCTION "private"."project_application_decide_atomic"(uuid,text,text,text,timestamp with time zone,text,jsonb) TO "service_role";
    GRANT EXECUTE ON FUNCTION "public"."project_application_decide_atomic"(uuid,text,text,text,timestamp with time zone,text,jsonb) TO "service_role";
  END IF;
END
$atomic_public_admission_acl$;
