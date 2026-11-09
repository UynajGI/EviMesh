CREATE TABLE "private"."api_token_audit_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"related_token_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_token_audit_events_type_allowed" CHECK ("private"."api_token_audit_events"."event_type" in ('issued', 'revoked', 'rotated', 'used')),
	CONSTRAINT "api_token_audit_events_details_object" CHECK (jsonb_typeof("private"."api_token_audit_events"."details") = 'object'),
	CONSTRAINT "api_token_audit_events_related_shape" CHECK (("private"."api_token_audit_events"."event_type" = 'rotated' and "private"."api_token_audit_events"."related_token_id" is not null and "private"."api_token_audit_events"."related_token_id" <> "private"."api_token_audit_events"."token_id")
        or ("private"."api_token_audit_events"."event_type" <> 'rotated' and "private"."api_token_audit_events"."related_token_id" is null))
);
--> statement-breakpoint
ALTER TABLE "api_tokens" DROP CONSTRAINT "api_tokens_rotation_state";--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "scopes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "private"."api_token_audit_events" ADD CONSTRAINT "api_token_audit_events_token_id_api_tokens_token_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("token_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."api_token_audit_events" ADD CONSTRAINT "api_token_audit_events_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."api_token_audit_events" ADD CONSTRAINT "api_token_audit_events_related_token_id_api_tokens_token_id_fk" FOREIGN KEY ("related_token_id") REFERENCES "public"."api_tokens"("token_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_token_audit_events_token_time_idx" ON "private"."api_token_audit_events" USING btree ("token_id","occurred_at");--> statement-breakpoint
CREATE INDEX "api_token_audit_events_actor_time_idx" ON "private"."api_token_audit_events" USING btree ("actor_id","occurred_at");--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_hash_shape" CHECK ("api_tokens"."token_hash" ~ '^[A-Za-z0-9_-]{43}$');--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_prefix_shape" CHECK ("api_tokens"."token_prefix" ~ '^evimesh_[A-Za-z0-9_-]{8}$');--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_scopes_registered" CHECK (jsonb_typeof("api_tokens"."scopes") = 'array'
        and jsonb_array_length("api_tokens"."scopes") between 1 and 5
        and "api_tokens"."scopes" <@ '["profile:read","project:read","research:prepare","research:submit","artifact:upload"]'::jsonb);--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_expiry_after_creation" CHECK ("api_tokens"."expires_at" is null or "api_tokens"."expires_at" > "api_tokens"."created_at");--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_revocation_after_creation" CHECK ("api_tokens"."revoked_at" is null or "api_tokens"."revoked_at" >= "api_tokens"."created_at");--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_last_use_after_creation" CHECK ("api_tokens"."last_used_at" is null or "api_tokens"."last_used_at" >= "api_tokens"."created_at");--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_not_soft_deleted" CHECK ("api_tokens"."deleted_at" is null);--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_rotation_state" CHECK (("api_tokens"."rotated_at" is null and "api_tokens"."rotated_from_token_id" is null)
        or ("api_tokens"."rotated_at" is not null and "api_tokens"."rotated_at" >= "api_tokens"."created_at"
          and "api_tokens"."rotated_from_token_id" is not null and "api_tokens"."rotated_from_token_id" <> "api_tokens"."token_id"));
--> statement-breakpoint

-- Credential rows and audit evidence are never browser-readable. Service code
-- receives only fixed safe projections through the allowlisted RPCs below.
ALTER TABLE "public"."api_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "actor_owned_api_tokens" ON "public"."api_tokens";--> statement-breakpoint
REVOKE ALL ON TABLE "public"."api_tokens" FROM PUBLIC;--> statement-breakpoint
ALTER TABLE "private"."api_token_audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "private"."api_token_audit_events" FROM PUBLIC;--> statement-breakpoint
DO $api_token_table_grants$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.api_tokens FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE private.api_token_audit_events FROM %I', role_name);
    END IF;
  END LOOP;
END
$api_token_table_grants$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."prevent_api_token_audit_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '[API_TOKEN_AUDIT_IMMUTABLE] API token audit events are append-only'
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "api_token_audit_events_append_only"
BEFORE UPDATE OR DELETE ON "private"."api_token_audit_events"
FOR EACH ROW EXECUTE FUNCTION "private"."prevent_api_token_audit_event_mutation"();--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."assert_verified_api_token_owner"(p_owner_actor_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  owner_auth_subject text;
  email_is_verified boolean := false;
BEGIN
  IF p_owner_actor_id IS NULL OR pg_catalog.btrim(p_owner_actor_id) = '' THEN
    RAISE EXCEPTION '[API_TOKEN_OWNER_FORBIDDEN] verified human owner is required'
      USING ERRCODE = '42501';
  END IF;
  SELECT "auth_subject" INTO owner_auth_subject
  FROM "public"."actors"
  WHERE "actor_id" = pg_catalog.btrim(p_owner_actor_id)
    AND "actor_type" IN ('human', 'maintainer')
    AND "auth_subject" IS NOT NULL
    AND "terms_accepted_at" IS NOT NULL
    AND "profile_completed_at" IS NOT NULL
    AND "deleted_at" IS NULL;
  IF NOT FOUND OR owner_auth_subject IS NULL THEN
    RAISE EXCEPTION '[API_TOKEN_OWNER_FORBIDDEN] verified human owner is required'
      USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION '[API_TOKEN_AUTH_UNAVAILABLE] Supabase auth users are unavailable'
      USING ERRCODE = '55000';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM auth.users WHERE id::text = $1 AND email_confirmed_at IS NOT NULL)'
    INTO email_is_verified
    USING owner_auth_subject;
  IF email_is_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION '[API_TOKEN_OWNER_FORBIDDEN] verified human owner is required'
      USING ERRCODE = '42501';
  END IF;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."api_token_auth_lookup"(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  token_result jsonb;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION '[API_TOKEN_HASH_INVALID] canonical token digest is required'
      USING ERRCODE = '22023';
  END IF;
  SELECT pg_catalog.jsonb_build_object(
    'tokenId', token_row."token_id",
    'actorId', token_row."actor_id",
    'scopes', token_row."scopes",
    'createdAt', token_row."created_at",
    'expiresAt', token_row."expires_at",
    'revokedAt', token_row."revoked_at",
    'lastUsedAt', token_row."last_used_at"
  ) INTO token_result
  FROM "public"."api_tokens" AS token_row
  WHERE token_row."token_hash" = p_token_hash
    AND token_row."deleted_at" IS NULL;
  RETURN token_result;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."api_token_mark_used"(p_token_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_now timestamptz := pg_catalog.clock_timestamp();
  token_row "public"."api_tokens"%ROWTYPE;
BEGIN
  SELECT * INTO token_row
  FROM "public"."api_tokens"
  WHERE "token_id" = p_token_id AND "deleted_at" IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND OR token_row.revoked_at IS NOT NULL
     OR (token_row.expires_at IS NOT NULL AND token_row.expires_at <= effective_now) THEN
    RAISE EXCEPTION '[API_TOKEN_NOT_ACTIVE] active API token was not found'
      USING ERRCODE = 'P0002';
  END IF;
  UPDATE "public"."api_tokens"
  SET "last_used_at" = GREATEST(COALESCE("last_used_at", "created_at"), effective_now),
      "updated_at" = effective_now
  WHERE "token_id" = token_row.token_id
  RETURNING * INTO token_row;
  INSERT INTO "private"."api_token_audit_events" (
    "token_id", "event_type", "actor_id", "details", "occurred_at"
  ) VALUES (
    token_row.token_id, 'used', token_row.actor_id,
    pg_catalog.jsonb_build_object('lastUsedAt', token_row.last_used_at), effective_now
  );
  RETURN pg_catalog.jsonb_build_object(
    'tokenId', token_row.token_id,
    'actorId', token_row.actor_id,
    'lastUsedAt', token_row.last_used_at
  );
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."api_token_list_owned_agent_tokens"(p_owner_actor_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  token_result jsonb;
BEGIN
  PERFORM "private"."assert_verified_api_token_owner"(p_owner_actor_id);
  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'tokenId', token_row."token_id",
        'agentActorId', token_row."actor_id",
        'tokenPrefix', token_row."token_prefix",
        'label', token_row."label",
        'scopes', token_row."scopes",
        'createdAt', token_row."created_at",
        'expiresAt', token_row."expires_at",
        'revokedAt', token_row."revoked_at",
        'lastUsedAt', token_row."last_used_at",
        'rotatedFromTokenId', token_row."rotated_from_token_id",
        'rotatedAt', token_row."rotated_at"
      ) ORDER BY token_row."created_at" DESC, token_row."token_id"
    ),
    '[]'::jsonb
  ) INTO token_result
  FROM "public"."api_tokens" AS token_row
  JOIN "public"."actors" AS agent_row ON agent_row."actor_id" = token_row."actor_id"
  WHERE agent_row."actor_type" = 'agent'
    AND agent_row."owner_actor_id" = pg_catalog.btrim(p_owner_actor_id)
    AND agent_row."deleted_at" IS NULL
    AND token_row."deleted_at" IS NULL;
  RETURN token_result;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."api_token_revoke_owned_agent_token"(
  p_owner_actor_id text,
  p_token_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_now timestamptz := pg_catalog.clock_timestamp();
  token_row "public"."api_tokens"%ROWTYPE;
BEGIN
  IF p_token_id IS NULL OR p_reason IS NULL
     OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION '[API_TOKEN_REVOCATION_INVALID] token id and reason are required'
      USING ERRCODE = '22023';
  END IF;
  PERFORM "private"."assert_verified_api_token_owner"(p_owner_actor_id);
  SELECT token_data.* INTO token_row
  FROM "public"."api_tokens" AS token_data
  JOIN "public"."actors" AS agent_row ON agent_row."actor_id" = token_data."actor_id"
  WHERE token_data."token_id" = p_token_id
    AND token_data."deleted_at" IS NULL
    AND agent_row."actor_type" = 'agent'
    AND agent_row."owner_actor_id" = pg_catalog.btrim(p_owner_actor_id)
    AND agent_row."deleted_at" IS NULL
  FOR NO KEY UPDATE OF token_data;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[API_TOKEN_NOT_FOUND] owned Agent token was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF token_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION '[API_TOKEN_ALREADY_REVOKED] token was already revoked'
      USING ERRCODE = '55000';
  END IF;
  UPDATE "public"."api_tokens"
  SET "revoked_at" = effective_now, "updated_at" = effective_now
  WHERE "token_id" = token_row.token_id
  RETURNING * INTO token_row;
  INSERT INTO "private"."api_token_audit_events" (
    "token_id", "event_type", "actor_id", "details", "occurred_at"
  ) VALUES (
    token_row.token_id, 'revoked', pg_catalog.btrim(p_owner_actor_id),
    pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason)), effective_now
  );
  RETURN pg_catalog.jsonb_build_object(
    'tokenId', token_row.token_id,
    'agentActorId', token_row.actor_id,
    'revokedAt', token_row.revoked_at
  );
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."api_token_rotate_owned_agent_token"(
  p_owner_actor_id text,
  p_old_token_id uuid,
  p_new_token_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_now timestamptz := pg_catalog.clock_timestamp();
  old_token "public"."api_tokens"%ROWTYPE;
  new_token "public"."api_tokens"%ROWTYPE;
BEGIN
  IF p_old_token_id IS NULL OR p_new_token_id IS NULL OR p_old_token_id = p_new_token_id
     OR p_reason IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION '[API_TOKEN_ROTATION_INVALID] distinct token ids and reason are required'
      USING ERRCODE = '22023';
  END IF;
  PERFORM "private"."assert_verified_api_token_owner"(p_owner_actor_id);
  -- A deterministic lock order makes two simultaneous rotations of the same
  -- predecessor serialize without deadlock.
  PERFORM 1
  FROM "public"."api_tokens"
  WHERE "token_id" IN (p_old_token_id, p_new_token_id)
  ORDER BY "token_id"
  FOR NO KEY UPDATE;

  SELECT token_data.* INTO old_token
  FROM "public"."api_tokens" AS token_data
  JOIN "public"."actors" AS agent_row ON agent_row."actor_id" = token_data."actor_id"
  WHERE token_data."token_id" = p_old_token_id
    AND token_data."deleted_at" IS NULL
    AND agent_row."actor_type" = 'agent'
    AND agent_row."owner_actor_id" = pg_catalog.btrim(p_owner_actor_id)
    AND agent_row."deleted_at" IS NULL;
  SELECT token_data.* INTO new_token
  FROM "public"."api_tokens" AS token_data
  JOIN "public"."actors" AS agent_row ON agent_row."actor_id" = token_data."actor_id"
  WHERE token_data."token_id" = p_new_token_id
    AND token_data."deleted_at" IS NULL
    AND agent_row."actor_type" = 'agent'
    AND agent_row."owner_actor_id" = pg_catalog.btrim(p_owner_actor_id)
    AND agent_row."deleted_at" IS NULL;
  IF old_token.token_id IS NULL OR new_token.token_id IS NULL
     OR old_token.actor_id IS DISTINCT FROM new_token.actor_id THEN
    RAISE EXCEPTION '[API_TOKEN_NOT_FOUND] owned Agent token pair was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF old_token.revoked_at IS NOT NULL
     OR new_token.revoked_at IS NOT NULL
     OR (new_token.expires_at IS NOT NULL AND new_token.expires_at <= effective_now)
     OR new_token.rotated_from_token_id IS NOT NULL
     OR new_token.last_used_at IS NOT NULL
     OR new_token.created_at <= old_token.created_at THEN
    RAISE EXCEPTION '[API_TOKEN_ROTATION_STATE_INVALID] token pair cannot be rotated'
      USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "private"."api_token_audit_events"
    WHERE "token_id" = new_token.token_id
      AND "event_type" = 'issued'
      AND "actor_id" = pg_catalog.btrim(p_owner_actor_id)
  ) THEN
    RAISE EXCEPTION '[API_TOKEN_ROTATION_DEVICE_AUTH_REQUIRED] replacement must be issued by Device Authorization'
      USING ERRCODE = '42501';
  END IF;

  UPDATE "public"."api_tokens"
  SET "revoked_at" = effective_now, "updated_at" = effective_now
  WHERE "token_id" = old_token.token_id;
  UPDATE "public"."api_tokens"
  SET "rotated_from_token_id" = old_token.token_id,
      "rotated_at" = effective_now,
      "updated_at" = effective_now
  WHERE "token_id" = new_token.token_id
  RETURNING * INTO new_token;
  INSERT INTO "private"."api_token_audit_events" (
    "token_id", "event_type", "actor_id", "details", "occurred_at"
  ) VALUES (
    old_token.token_id, 'revoked', pg_catalog.btrim(p_owner_actor_id),
    pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason), 'replacementTokenId', new_token.token_id),
    effective_now
  );
  INSERT INTO "private"."api_token_audit_events" (
    "token_id", "event_type", "actor_id", "related_token_id", "details", "occurred_at"
  ) VALUES (
    new_token.token_id, 'rotated', pg_catalog.btrim(p_owner_actor_id), old_token.token_id,
    pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason)), effective_now
  );
  RETURN pg_catalog.jsonb_build_object(
    'tokenId', new_token.token_id,
    'agentActorId', new_token.actor_id,
    'rotatedFromTokenId', new_token.rotated_from_token_id,
    'rotatedAt', new_token.rotated_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '[API_TOKEN_ROTATION_CONFLICT] predecessor already has a replacement'
      USING ERRCODE = '23505';
END;
$$;--> statement-breakpoint

-- Preserve the 0085 consume signature/semantics; add only the mandatory token
-- issuance audit in the same transaction as the credential and DeviceGrant.
CREATE OR REPLACE FUNCTION "public"."device_authorization_consume"(
  p_device_code_digest text,
  p_consumed_at timestamptz,
  p_token_id uuid,
  p_token_hash text,
  p_token_prefix text,
  p_token_label text,
  p_token_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grant "private"."device_authorizations"%ROWTYPE;
  v_event_id uuid;
BEGIN
  SELECT * INTO v_grant
  FROM "private"."device_authorizations"
  WHERE device_code_digest = p_device_code_digest
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[DEVICE_AUTH_NOT_FOUND] device code was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF p_consumed_at IS NULL OR v_grant.expires_at <= p_consumed_at THEN
    RAISE EXCEPTION '[DEVICE_AUTH_EXPIRED] device code has expired'
      USING ERRCODE = '22023';
  END IF;
  IF v_grant.status = 'pending' THEN
    RAISE EXCEPTION '[DEVICE_AUTH_PENDING] authorization is still pending'
      USING ERRCODE = '55000';
  END IF;
  IF v_grant.status = 'denied' THEN
    RAISE EXCEPTION '[DEVICE_AUTH_DENIED] authorization was denied'
      USING ERRCODE = '42501';
  END IF;
  IF v_grant.status <> 'approved' THEN
    RAISE EXCEPTION '[DEVICE_AUTH_ALREADY_USED] device authorization was already consumed'
      USING ERRCODE = '55000';
  END IF;
  IF p_token_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[A-Za-z0-9_-]{43}$'
     OR p_token_prefix IS NULL OR p_token_prefix !~ '^evimesh_[A-Za-z0-9_-]{8}$'
     OR p_token_label IS NULL OR char_length(btrim(p_token_label)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION '[INVALID_REQUEST] token metadata is invalid'
      USING ERRCODE = '22023';
  END IF;
  IF p_token_expires_at IS NOT NULL AND p_token_expires_at <= p_consumed_at THEN
    RAISE EXCEPTION '[INVALID_REQUEST] token expiry must be after issuance'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO "public"."api_tokens" (
    token_id, actor_id, token_hash, token_prefix, label, scopes,
    expires_at, created_at, updated_at
  ) VALUES (
    p_token_id,
    v_grant.agent_actor_id,
    p_token_hash,
    p_token_prefix,
    btrim(p_token_label),
    to_jsonb(v_grant.requested_scopes),
    p_token_expires_at,
    p_consumed_at,
    p_consumed_at
  );

  INSERT INTO "private"."api_token_audit_events" (
    token_id, event_type, actor_id, details, occurred_at
  ) VALUES (
    p_token_id,
    'issued',
    v_grant.approved_by_actor_id,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'deviceAuthorizationId', v_grant.device_authorization_id,
      'agentActorId', v_grant.agent_actor_id,
      'tokenPrefix', p_token_prefix,
      'tokenLabel', btrim(p_token_label),
      'tokenScopes', to_jsonb(v_grant.requested_scopes),
      'tokenExpiresAt', p_token_expires_at
    )),
    p_consumed_at
  );

  INSERT INTO "private"."device_authorization_events" (
    device_authorization_id, event_type, actor_id, details, occurred_at
  ) VALUES (
    v_grant.device_authorization_id,
    'consumed',
    v_grant.approved_by_actor_id,
    jsonb_build_object(
      'agentActorId', v_grant.agent_actor_id,
      'approvedByActorId', v_grant.approved_by_actor_id,
      'tokenId', p_token_id,
      'tokenPrefix', p_token_prefix,
      'tokenLabel', btrim(p_token_label),
      'tokenScopes', to_jsonb(v_grant.requested_scopes),
      'tokenExpiresAt', p_token_expires_at
    ),
    p_consumed_at
  )
  RETURNING event_id INTO v_event_id;

  UPDATE "private"."device_authorizations"
  SET status = 'consumed',
      issued_token_id = p_token_id,
      consumed_at = p_consumed_at,
      consumption_event_id = v_event_id
  WHERE device_authorization_id = v_grant.device_authorization_id;

  RETURN "private"."device_authorization_response"(v_grant.device_authorization_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '[DEVICE_AUTH_CODE_COLLISION] token id or hash already exists'
      USING ERRCODE = '23505';
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION "private"."prevent_api_token_audit_event_mutation"() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."assert_verified_api_token_owner"(text) FROM PUBLIC;--> statement-breakpoint
DO $api_token_function_grants$
DECLARE
  function_signature text;
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.api_token_auth_lookup(text)',
    'public.api_token_mark_used(uuid)',
    'public.api_token_list_owned_agent_tokens(text)',
    'public.api_token_revoke_owned_agent_token(text,uuid,text)',
    'public.api_token_rotate_owned_agent_token(text,uuid,uuid,text)',
    'public.device_authorization_consume(text,timestamp with time zone,uuid,text,text,text,timestamp with time zone)'
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
$api_token_function_grants$;
