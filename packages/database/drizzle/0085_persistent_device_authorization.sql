CREATE TABLE "private"."device_authorization_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_authorization_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_authorization_events_type_allowed" CHECK ("private"."device_authorization_events"."event_type" in ('started', 'approved', 'consumed', 'denied'))
);
--> statement-breakpoint
CREATE TABLE "private"."device_authorizations" (
	"device_authorization_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_code_digest" text NOT NULL,
	"user_code_digest" text NOT NULL,
	"client_id" text NOT NULL,
	"requested_scopes" text[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"agent_actor_id" text,
	"approved_by_actor_id" text,
	"denied_by_actor_id" text,
	"issued_token_id" uuid,
	"created_event_id" uuid,
	"approval_event_id" uuid,
	"consumption_event_id" uuid,
	"denial_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"denied_at" timestamp with time zone,
	CONSTRAINT "device_authorizations_device_code_digest_unique" UNIQUE("device_code_digest"),
	CONSTRAINT "device_authorizations_user_code_digest_unique" UNIQUE("user_code_digest"),
	CONSTRAINT "device_authorizations_issued_token_id_unique" UNIQUE("issued_token_id"),
	CONSTRAINT "device_authorizations_device_code_digest_sha256" CHECK ("private"."device_authorizations"."device_code_digest" ~ '^[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "device_authorizations_user_code_digest_sha256" CHECK ("private"."device_authorizations"."user_code_digest" ~ '^[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "device_authorizations_client_id_length" CHECK (char_length("private"."device_authorizations"."client_id") between 1 and 100),
	CONSTRAINT "device_authorizations_requested_scopes_allowed" CHECK (cardinality("private"."device_authorizations"."requested_scopes") between 1 and 5 and "private"."device_authorizations"."requested_scopes" <@ array['profile:read', 'project:read', 'research:prepare', 'research:submit', 'artifact:upload']::text[]),
	CONSTRAINT "device_authorizations_status_allowed" CHECK ("private"."device_authorizations"."status" in ('pending', 'approved', 'consumed', 'denied')),
	CONSTRAINT "device_authorizations_expiry_after_creation" CHECK ("private"."device_authorizations"."expires_at" > "private"."device_authorizations"."created_at"),
	CONSTRAINT "device_authorizations_lifecycle_shape" CHECK (
        ("private"."device_authorizations"."status" = 'pending' and "private"."device_authorizations"."agent_actor_id" is null and "private"."device_authorizations"."approved_by_actor_id" is null and "private"."device_authorizations"."approved_at" is null and "private"."device_authorizations"."issued_token_id" is null and "private"."device_authorizations"."consumed_at" is null and "private"."device_authorizations"."denied_at" is null)
        or ("private"."device_authorizations"."status" = 'approved' and "private"."device_authorizations"."agent_actor_id" is not null and "private"."device_authorizations"."approved_by_actor_id" is not null and "private"."device_authorizations"."approved_at" is not null and "private"."device_authorizations"."approval_event_id" is not null and "private"."device_authorizations"."issued_token_id" is null and "private"."device_authorizations"."consumed_at" is null and "private"."device_authorizations"."denied_at" is null)
        or ("private"."device_authorizations"."status" = 'consumed' and "private"."device_authorizations"."agent_actor_id" is not null and "private"."device_authorizations"."approved_by_actor_id" is not null and "private"."device_authorizations"."approved_at" is not null and "private"."device_authorizations"."approval_event_id" is not null and "private"."device_authorizations"."issued_token_id" is not null and "private"."device_authorizations"."consumed_at" is not null and "private"."device_authorizations"."consumption_event_id" is not null and "private"."device_authorizations"."denied_at" is null)
        or ("private"."device_authorizations"."status" = 'denied' and "private"."device_authorizations"."denied_by_actor_id" is not null and "private"."device_authorizations"."denied_at" is not null and "private"."device_authorizations"."denial_event_id" is not null and "private"."device_authorizations"."issued_token_id" is null and "private"."device_authorizations"."consumed_at" is null)
      )
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "label" text DEFAULT 'API token' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "rotated_from_token_id" uuid;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "rotated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "private"."device_authorization_events" ADD CONSTRAINT "device_authorization_events_device_authorization_id_device_authorizations_device_authorization_id_fk" FOREIGN KEY ("device_authorization_id") REFERENCES "private"."device_authorizations"("device_authorization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorization_events" ADD CONSTRAINT "device_authorization_events_actor_id_actors_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorizations" ADD CONSTRAINT "device_authorizations_agent_actor_id_actors_actor_id_fk" FOREIGN KEY ("agent_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorizations" ADD CONSTRAINT "device_authorizations_approved_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("approved_by_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorizations" ADD CONSTRAINT "device_authorizations_denied_by_actor_id_actors_actor_id_fk" FOREIGN KEY ("denied_by_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorizations" ADD CONSTRAINT "device_authorizations_issued_token_id_api_tokens_token_id_fk" FOREIGN KEY ("issued_token_id") REFERENCES "public"."api_tokens"("token_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorizations" ADD CONSTRAINT "device_authorizations_created_event_id_events_event_id_fk" FOREIGN KEY ("created_event_id") REFERENCES "private"."device_authorization_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorizations" ADD CONSTRAINT "device_authorizations_approval_event_id_events_event_id_fk" FOREIGN KEY ("approval_event_id") REFERENCES "private"."device_authorization_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorizations" ADD CONSTRAINT "device_authorizations_consumption_event_id_events_event_id_fk" FOREIGN KEY ("consumption_event_id") REFERENCES "private"."device_authorization_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."device_authorizations" ADD CONSTRAINT "device_authorizations_denial_event_id_events_event_id_fk" FOREIGN KEY ("denial_event_id") REFERENCES "private"."device_authorization_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_authorization_events_grant_time_idx" ON "private"."device_authorization_events" USING btree ("device_authorization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "device_authorizations_expires_at_idx" ON "private"."device_authorizations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "device_authorizations_approved_by_actor_id_idx" ON "private"."device_authorizations" USING btree ("approved_by_actor_id");--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_rotated_from_token_id_api_tokens_token_id_fk" FOREIGN KEY ("rotated_from_token_id") REFERENCES "public"."api_tokens"("token_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_rotated_from_token_id_unique" UNIQUE("rotated_from_token_id");--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_label_length" CHECK (char_length("api_tokens"."label") between 1 and 100);--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_rotation_state" CHECK (("api_tokens"."rotated_at" is null and "api_tokens"."rotated_from_token_id" is null) or ("api_tokens"."rotated_at" is not null and "api_tokens"."rotated_from_token_id" is not null));
--> statement-breakpoint

-- Device Authorization is account-security state, not research content. The
-- private tables remain unreachable through PostgREST; only the allowlisted
-- service-role RPCs below can advance their lifecycle.
ALTER TABLE "private"."device_authorizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "private"."device_authorization_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON SCHEMA "private" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE "private"."device_authorizations" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE "private"."device_authorization_events" FROM PUBLIC;
--> statement-breakpoint

DO $device_authorization_table_grants$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE private.device_authorizations FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE private.device_authorization_events FROM %I', role_name);
    END IF;
  END LOOP;
END
$device_authorization_table_grants$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."device_authorization_response"(p_device_authorization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'deviceAuthorizationId', grant_row.device_authorization_id,
    'status', grant_row.status,
    'clientId', grant_row.client_id,
    'requestedScopes', to_jsonb(grant_row.requested_scopes),
    'createdAt', grant_row.created_at,
    'expiresAt', grant_row.expires_at,
    'agentActorId', grant_row.agent_actor_id,
    'approvedByActorId', grant_row.approved_by_actor_id,
    'deniedByActorId', grant_row.denied_by_actor_id,
    'issuedTokenId', grant_row.issued_token_id,
    'approvedAt', grant_row.approved_at,
    'consumedAt', grant_row.consumed_at,
    'deniedAt', grant_row.denied_at,
    'createdEventId', grant_row.created_event_id,
    'approvalEventId', grant_row.approval_event_id,
    'consumptionEventId', grant_row.consumption_event_id,
    'denialEventId', grant_row.denial_event_id
  )
  FROM "private"."device_authorizations" AS grant_row
  WHERE grant_row.device_authorization_id = p_device_authorization_id;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "private"."prevent_device_authorization_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '[DEVICE_AUTH_AUDIT_IMMUTABLE] device authorization audit events are append-only'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "device_authorization_events_append_only"
BEFORE UPDATE OR DELETE ON "private"."device_authorization_events"
FOR EACH ROW EXECUTE FUNCTION "private"."prevent_device_authorization_event_mutation"();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."device_authorization_start"(
  p_device_code_digest text,
  p_user_code_digest text,
  p_client_id text,
  p_requested_scopes text[],
  p_created_at timestamptz,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grant_id uuid;
  v_event_id uuid;
  v_scopes text[];
BEGIN
  IF p_device_code_digest IS NULL OR p_device_code_digest !~ '^[A-Za-z0-9_-]{43}$'
     OR p_user_code_digest IS NULL OR p_user_code_digest !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION '[INVALID_REQUEST] device and user code digests must be SHA-256 base64url values'
      USING ERRCODE = '22023';
  END IF;
  IF p_client_id IS NULL OR char_length(btrim(p_client_id)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION '[INVALID_REQUEST] client id must contain 1 to 100 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_created_at IS NULL OR p_expires_at IS NULL OR p_expires_at <= p_created_at THEN
    RAISE EXCEPTION '[INVALID_REQUEST] expiry must be after creation'
      USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(scope ORDER BY scope), '{}'::text[])
  INTO v_scopes
  FROM (
    SELECT DISTINCT btrim(raw_scope) AS scope
    FROM unnest(coalesce(p_requested_scopes, '{}'::text[])) AS raw_scope
    WHERE btrim(raw_scope) <> ''
  ) AS normalized;

  IF cardinality(v_scopes) NOT BETWEEN 1 AND 5
     OR NOT (v_scopes <@ ARRAY['profile:read', 'project:read', 'research:prepare', 'research:submit', 'artifact:upload']::text[]) THEN
    RAISE EXCEPTION '[INVALID_SCOPE] requested scopes are outside the fixed registry'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO "private"."device_authorizations" (
    device_code_digest, user_code_digest, client_id, requested_scopes,
    status, created_at, expires_at
  ) VALUES (
    p_device_code_digest, p_user_code_digest, btrim(p_client_id), v_scopes,
    'pending', p_created_at, p_expires_at
  )
  RETURNING device_authorization_id INTO v_grant_id;

  INSERT INTO "private"."device_authorization_events" (
    device_authorization_id, event_type, details, occurred_at
  ) VALUES (
    v_grant_id,
    'started',
    jsonb_build_object('clientId', btrim(p_client_id), 'requestedScopes', to_jsonb(v_scopes)),
    p_created_at
  )
  RETURNING event_id INTO v_event_id;

  UPDATE "private"."device_authorizations"
  SET created_event_id = v_event_id
  WHERE device_authorization_id = v_grant_id;

  RETURN "private"."device_authorization_response"(v_grant_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION '[DEVICE_AUTH_CODE_COLLISION] generated code digest already exists'
      USING ERRCODE = '23505';
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."device_authorization_preview"(
  p_user_code_digest text,
  p_now timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grant "private"."device_authorizations"%ROWTYPE;
BEGIN
  SELECT * INTO v_grant
  FROM "private"."device_authorizations"
  WHERE user_code_digest = p_user_code_digest;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[DEVICE_AUTH_NOT_FOUND] user code was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF p_now IS NULL OR v_grant.expires_at <= p_now THEN
    RAISE EXCEPTION '[DEVICE_AUTH_EXPIRED] user code has expired'
      USING ERRCODE = '22023';
  END IF;

  RETURN "private"."device_authorization_response"(v_grant.device_authorization_id);
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."device_authorization_approve"(
  p_user_code_digest text,
  p_approved_by_actor_id text,
  p_agent_actor_id text,
  p_approved_at timestamptz
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
  WHERE user_code_digest = p_user_code_digest
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[DEVICE_AUTH_NOT_FOUND] user code was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF p_approved_at IS NULL OR v_grant.expires_at <= p_approved_at THEN
    RAISE EXCEPTION '[DEVICE_AUTH_EXPIRED] user code has expired'
      USING ERRCODE = '22023';
  END IF;
  IF v_grant.status <> 'pending' THEN
    RAISE EXCEPTION '[DEVICE_AUTH_ALREADY_USED] device authorization is no longer pending'
      USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors" AS approver
    WHERE approver.actor_id = p_approved_by_actor_id
      AND approver.actor_type IN ('human', 'maintainer')
      AND approver.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION '[DEVICE_AUTH_APPROVER_INVALID] approver is not an active human actor'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors" AS agent
    WHERE agent.actor_id = p_agent_actor_id
      AND agent.actor_type = 'agent'
      AND agent.owner_actor_id = p_approved_by_actor_id
      AND agent.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION '[DEVICE_AUTH_AGENT_NOT_MANAGED] selected agent is not managed by the approver'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO "private"."device_authorization_events" (
    device_authorization_id, event_type, actor_id, details, occurred_at
  ) VALUES (
    v_grant.device_authorization_id,
    'approved',
    p_approved_by_actor_id,
    jsonb_build_object('agentActorId', p_agent_actor_id, 'clientId', v_grant.client_id, 'requestedScopes', to_jsonb(v_grant.requested_scopes)),
    p_approved_at
  )
  RETURNING event_id INTO v_event_id;

  UPDATE "private"."device_authorizations"
  SET status = 'approved',
      agent_actor_id = p_agent_actor_id,
      approved_by_actor_id = p_approved_by_actor_id,
      approved_at = p_approved_at,
      approval_event_id = v_event_id
  WHERE device_authorization_id = v_grant.device_authorization_id;

  RETURN "private"."device_authorization_response"(v_grant.device_authorization_id);
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."device_authorization_deny"(
  p_user_code_digest text,
  p_denied_by_actor_id text,
  p_denied_at timestamptz
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
  WHERE user_code_digest = p_user_code_digest
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '[DEVICE_AUTH_NOT_FOUND] user code was not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF p_denied_at IS NULL OR v_grant.expires_at <= p_denied_at THEN
    RAISE EXCEPTION '[DEVICE_AUTH_EXPIRED] user code has expired'
      USING ERRCODE = '22023';
  END IF;
  IF v_grant.status <> 'pending' THEN
    RAISE EXCEPTION '[DEVICE_AUTH_ALREADY_USED] device authorization is no longer pending'
      USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "public"."actors" AS actor
    WHERE actor.actor_id = p_denied_by_actor_id
      AND actor.actor_type IN ('human', 'maintainer')
      AND actor.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION '[DEVICE_AUTH_APPROVER_INVALID] denying actor is not active'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO "private"."device_authorization_events" (
    device_authorization_id, event_type, actor_id, details, occurred_at
  ) VALUES (
    v_grant.device_authorization_id,
    'denied',
    p_denied_by_actor_id,
    jsonb_build_object('clientId', v_grant.client_id),
    p_denied_at
  )
  RETURNING event_id INTO v_event_id;

  UPDATE "private"."device_authorizations"
  SET status = 'denied',
      denied_by_actor_id = p_denied_by_actor_id,
      denied_at = p_denied_at,
      denial_event_id = v_event_id
  WHERE device_authorization_id = v_grant.device_authorization_id;

  RETURN "private"."device_authorization_response"(v_grant.device_authorization_id);
END;
$$;
--> statement-breakpoint

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
     OR p_token_prefix IS NULL OR char_length(p_token_prefix) NOT BETWEEN 8 AND 32
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
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION "private"."device_authorization_response"(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."prevent_device_authorization_event_mutation"() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."device_authorization_start"(text, text, text, text[], timestamptz, timestamptz) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."device_authorization_preview"(text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."device_authorization_approve"(text, text, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."device_authorization_deny"(text, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."device_authorization_consume"(text, timestamptz, uuid, text, text, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint

DO $device_authorization_function_grants$
DECLARE
  function_signature text;
BEGIN
  FOREACH function_signature IN ARRAY ARRAY[
    'public.device_authorization_start(text,text,text,text[],timestamp with time zone,timestamp with time zone)',
    'public.device_authorization_preview(text,timestamp with time zone)',
    'public.device_authorization_approve(text,text,text,timestamp with time zone)',
    'public.device_authorization_deny(text,text,timestamp with time zone)',
    'public.device_authorization_consume(text,timestamp with time zone,uuid,text,text,text,timestamp with time zone)'
  ] LOOP
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
$device_authorization_function_grants$;
