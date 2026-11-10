-- 0090: close the public write loop.
--
-- 1. A Human creates and retires the Agent actors they own. An Agent never
--    receives a human auth subject, so it can never sign in as a person.
-- 2. A project owner/maintainer enrolls an Agent they personally own as a
--    contributor (the role execute_typed_research_submit requires). Agents
--    are never invited like humans and never self-enroll.
-- 3. A platform service actor exists for platform-governance events.
-- 4. The atomic typed submit accepts Question and Claim v1 documents. Both
--    are written to the legacy projection (questions/claims tables the Web
--    reads) and to the kernel graph in one transaction, signed by the Human
--    publisher and relayed by their Agent.

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
      'project_membership.removed', 'project_membership.reactivated',
      'agent.created', 'agent.retired',
      'project_agent.enrolled', 'project_agent.removed'
    )
  );--> statement-breakpoint

-- ------------------------------------------------------------------ agents
CREATE OR REPLACE FUNCTION private.managed_agent_create(
  p_owner_actor_id text,
  p_display_name text,
  p_model_name text,
  p_runtime text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner text := pg_catalog.btrim(p_owner_actor_id);
  v_name text := pg_catalog.btrim(p_display_name);
  v_model text := NULLIF(pg_catalog.btrim(COALESCE(p_model_name,'')),'');
  v_runtime text := NULLIF(pg_catalog.btrim(COALESCE(p_runtime,'')),'');
  v_agent_id text;
  v_count integer;
BEGIN
  IF v_owner IS NULL OR v_owner = ''
     OR v_name IS NULL OR pg_catalog.char_length(v_name) NOT BETWEEN 1 AND 80
     OR (v_model IS NOT NULL AND pg_catalog.char_length(v_model) > 120)
     OR (v_runtime IS NOT NULL AND pg_catalog.char_length(v_runtime) > 120) THEN
    RAISE EXCEPTION '[MANAGED_AGENT_INPUT_INVALID] an Agent name of 1-80 characters is required'
      USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.actors
  WHERE actor_id = v_owner AND actor_type IN ('human','maintainer')
    AND auth_subject IS NOT NULL AND deleted_at IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[MANAGED_AGENT_OWNER_INVALID] an active Human owner is required'
      USING ERRCODE = '42501';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_count FROM public.actors
  WHERE owner_actor_id = v_owner AND actor_type = 'agent' AND deleted_at IS NULL;
  IF v_count >= 20 THEN
    RAISE EXCEPTION '[MANAGED_AGENT_LIMIT] a Human may own at most 20 active Agents'
      USING ERRCODE = '55000';
  END IF;
  v_agent_id := 'agent_' || pg_catalog.replace(extensions.gen_random_uuid()::text, '-', '');
  INSERT INTO public.actors (actor_id, actor_type, identity_strength, owner_actor_id, model_name, runtime, created_at, updated_at)
  VALUES (v_agent_id, 'agent', 'self_declared', v_owner, v_model, v_runtime, pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp());
  INSERT INTO public.actor_profiles (actor_id, display_name, created_at, updated_at)
  VALUES (v_agent_id, v_name, pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp());
  INSERT INTO private.admission_audit_events (event_type, actor_id, subject_type, subject_id, details, occurred_at)
  VALUES ('agent.created', v_owner, 'actor', v_agent_id,
    pg_catalog.jsonb_build_object('displayName', v_name, 'modelName', v_model, 'runtime', v_runtime),
    pg_catalog.transaction_timestamp());
  RETURN pg_catalog.jsonb_build_object(
    'schema','evimesh.managed-agent.v1','actorId',v_agent_id,'actorType','agent','ownerActorId',v_owner,
    'displayName',v_name,'modelName',v_model,'runtime',v_runtime,'createdAt',pg_catalog.transaction_timestamp()
  );
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.managed_agent_retire(
  p_owner_actor_id text,
  p_agent_actor_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_tokens integer;
BEGIN
  IF NULLIF(pg_catalog.btrim(COALESCE(p_reason,'')),'') IS NULL OR pg_catalog.char_length(p_reason) > 500 THEN
    RAISE EXCEPTION '[MANAGED_AGENT_INPUT_INVALID] a retirement reason is required' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.actors
  WHERE actor_id = pg_catalog.btrim(p_agent_actor_id) AND actor_type = 'agent'
    AND owner_actor_id = pg_catalog.btrim(p_owner_actor_id) AND deleted_at IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[MANAGED_AGENT_NOT_FOUND] owned active Agent was not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.api_tokens SET revoked_at = v_now, updated_at = v_now
  WHERE actor_id = pg_catalog.btrim(p_agent_actor_id) AND revoked_at IS NULL;
  GET DIAGNOSTICS v_tokens = ROW_COUNT;
  UPDATE public.project_members
  SET status = 'removed', removed_by_actor_id = pg_catalog.btrim(p_owner_actor_id), removed_at = v_now,
      removal_reason = 'agent retired', updated_at = v_now
  WHERE actor_id = pg_catalog.btrim(p_agent_actor_id) AND status = 'active';
  UPDATE public.actors SET deleted_at = v_now, updated_at = v_now
  WHERE actor_id = pg_catalog.btrim(p_agent_actor_id);
  INSERT INTO private.admission_audit_events (event_type, actor_id, subject_type, subject_id, details, occurred_at)
  VALUES ('agent.retired', pg_catalog.btrim(p_owner_actor_id), 'actor', pg_catalog.btrim(p_agent_actor_id),
    pg_catalog.jsonb_build_object('reason', pg_catalog.btrim(p_reason), 'revokedTokens', v_tokens), v_now);
  RETURN pg_catalog.jsonb_build_object('actorId', pg_catalog.btrim(p_agent_actor_id), 'retiredAt', v_now, 'revokedTokens', v_tokens);
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.project_agent_enroll(
  p_project_id text,
  p_agent_actor_id text,
  p_enrolled_by_actor_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project text := pg_catalog.btrim(p_project_id);
  v_agent text := pg_catalog.btrim(p_agent_actor_id);
  v_human text := pg_catalog.btrim(p_enrolled_by_actor_id);
  v_role text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  PERFORM 1 FROM public.projects WHERE project_id = v_project AND state = 'active' AND deleted_at IS NULL FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[PROJECT_AGENT_PROJECT_INACTIVE] active project was not found' USING ERRCODE = '55000';
  END IF;
  SELECT role INTO v_role FROM public.project_members
  WHERE project_id = v_project AND actor_id = v_human AND status = 'active' AND deleted_at IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND OR v_role NOT IN ('owner','maintainer','contributor') THEN
    RAISE EXCEPTION '[PROJECT_AGENT_FORBIDDEN] contributor-or-higher project membership is required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.actors
  WHERE actor_id = v_agent AND actor_type = 'agent' AND owner_actor_id = v_human AND deleted_at IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[PROJECT_AGENT_NOT_OWNED] only an Agent you own can be enrolled' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.project_members (project_id, actor_id, role, status, invited_by_actor_id, joined_at, created_at, updated_at)
  VALUES (v_project, v_agent, 'contributor', 'active', v_human, v_now, v_now, v_now)
  ON CONFLICT (project_id, actor_id) DO UPDATE
  SET role = 'contributor', status = 'active', invited_by_actor_id = EXCLUDED.invited_by_actor_id,
      joined_at = EXCLUDED.joined_at, removed_by_actor_id = NULL, removed_at = NULL, removal_reason = NULL,
      updated_at = EXCLUDED.updated_at, deleted_at = NULL;
  INSERT INTO private.admission_audit_events (event_type, actor_id, subject_type, subject_id, details, occurred_at)
  VALUES ('project_agent.enrolled', v_human, 'project_membership', v_project || ':' || v_agent,
    pg_catalog.jsonb_build_object('role','contributor'), v_now);
  RETURN pg_catalog.jsonb_build_object('projectId', v_project, 'actorId', v_agent, 'role', 'contributor', 'status', 'active', 'enrolledBy', v_human, 'joinedAt', v_now);
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.project_agent_remove(
  p_project_id text,
  p_agent_actor_id text,
  p_removed_by_actor_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project text := pg_catalog.btrim(p_project_id);
  v_agent text := pg_catalog.btrim(p_agent_actor_id);
  v_human text := pg_catalog.btrim(p_removed_by_actor_id);
  v_owner text;
  v_role text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  SELECT owner_actor_id INTO v_owner FROM public.actors WHERE actor_id = v_agent AND actor_type = 'agent';
  SELECT role INTO v_role FROM public.project_members
  WHERE project_id = v_project AND actor_id = v_human AND status = 'active' AND deleted_at IS NULL;
  IF v_owner IS DISTINCT FROM v_human AND COALESCE(v_role,'') NOT IN ('owner','maintainer') THEN
    RAISE EXCEPTION '[PROJECT_AGENT_FORBIDDEN] the Agent owner or a project maintainer is required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.project_members
  SET status = 'removed', removed_by_actor_id = v_human, removed_at = v_now, removal_reason = 'agent removed from project', updated_at = v_now
  WHERE project_id = v_project AND actor_id = v_agent AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION '[PROJECT_AGENT_NOT_FOUND] the Agent is not an active project member' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO private.admission_audit_events (event_type, actor_id, subject_type, subject_id, details, occurred_at)
  VALUES ('project_agent.removed', v_human, 'project_membership', v_project || ':' || v_agent, '{}'::jsonb, v_now);
  RETURN pg_catalog.jsonb_build_object('projectId', v_project, 'actorId', v_agent, 'status', 'removed', 'removedAt', v_now);
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.managed_agent_create(p_owner_actor_id text, p_display_name text, p_model_name text, p_runtime text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.managed_agent_create(p_owner_actor_id, p_display_name, p_model_name, p_runtime) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.managed_agent_retire(p_owner_actor_id text, p_agent_actor_id text, p_reason text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.managed_agent_retire(p_owner_actor_id, p_agent_actor_id, p_reason) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.project_agent_enroll(p_project_id text, p_agent_actor_id text, p_enrolled_by_actor_id text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.project_agent_enroll(p_project_id, p_agent_actor_id, p_enrolled_by_actor_id) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.project_agent_remove(p_project_id text, p_agent_actor_id text, p_removed_by_actor_id text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.project_agent_remove(p_project_id, p_agent_actor_id, p_removed_by_actor_id) $$;
--> statement-breakpoint

-- --------------------------------------------------- platform service actor
INSERT INTO public.actors (actor_id, actor_type, identity_strength, created_at, updated_at)
VALUES ('actor_platform_evimesh', 'service', 'verified', now(), now())
ON CONFLICT (actor_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.actor_profiles (actor_id, display_name, bio, created_at, updated_at)
VALUES ('actor_platform_evimesh', 'EviMesh platform', 'Platform governance signer. Never authors research.', now(), now())
ON CONFLICT (actor_id) DO NOTHING;
--> statement-breakpoint

-- ------------------------------------- typed submit: Question and Claim v1
-- Extend the server-derived motif. Question v1: optional extends_question
-- from earlier Questions. Claim v1: optional yields_claim from Answers,
-- derived_from/extends/implements from earlier Claims, uses_dataset/uses_tool.
CREATE OR REPLACE FUNCTION private.derive_typed_research_incoming_edges_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_kind text := p_payload->>'entityType';
  v_node jsonb := p_payload->'node';
  v_target jsonb;
  v_edges jsonb := '[]'::jsonb;
  v_revision integer;
  v_item jsonb;
  v_ref jsonb;
  v_index integer := 0;
  v_relation text;
  v_count integer;
  v_unique_count integer;
BEGIN
  IF v_kind NOT IN ('question','claim') THEN
    RETURN private.derive_typed_research_incoming_edges(p_payload);
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR NOT (p_payload ?& ARRAY['schema','entityType','graphVersion','producerActorId','draftedByActorId','publisherActorId','signerActorId','node','incomingEdges'])
     OR (p_payload - ARRAY['schema','entityType','graphVersion','producerActorId','draftedByActorId','publisherActorId','signerActorId','node','incomingEdges']::text[]) <> '{}'::jsonb
     OR jsonb_typeof(v_node) IS DISTINCT FROM 'object'
     OR p_payload->>'graphVersion' IS DISTINCT FROM 'research-graph.v1'
     OR p_payload->>'signerActorId' IS DISTINCT FROM p_payload->>'publisherActorId'
     OR p_payload->>'schema' IS DISTINCT FROM ('srp.' || v_kind || '.v1') THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] canonical payload has an unexpected shape' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(v_node->'revision') IS DISTINCT FROM 'number' OR v_node->>'revision' !~ '^[1-9][0-9]{0,9}$'
     OR jsonb_typeof(v_node->'projectId') IS DISTINCT FROM 'string' OR btrim(v_node->>'projectId') = '' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] typed node common fields are invalid' USING ERRCODE = 'P0001';
  END IF;
  v_revision := (v_node->>'revision')::integer;
  IF v_revision = 1 AND jsonb_typeof(v_node->'supersedesRevision') IS DISTINCT FROM 'null' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_REVISION_INVALID] revision 1 cannot supersede a previous revision' USING ERRCODE = 'P0001';
  END IF;
  IF v_revision > 1 AND (v_node->>'supersedesRevision')::numeric IS DISTINCT FROM (v_revision - 1) THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_REVISION_INVALID] a new revision must supersede the immediately previous revision' USING ERRCODE = 'P0001';
  END IF;

  IF v_kind = 'question' THEN
    IF NOT (v_node ?& ARRAY['questionId','projectId','revision','supersedesRevision','state','title','statement','topics','researchContract','extendsRefs'])
       OR (v_node - ARRAY['questionId','projectId','revision','supersedesRevision','state','title','statement','topics','researchContract','extendsRefs']::text[]) <> '{}'::jsonb
       OR jsonb_typeof(v_node->'questionId') IS DISTINCT FROM 'string' OR btrim(v_node->>'questionId') = '' OR length(v_node->>'questionId') > 200
       OR jsonb_typeof(v_node->'title') IS DISTINCT FROM 'string' OR length(btrim(v_node->>'title')) NOT BETWEEN 1 AND 300
       OR jsonb_typeof(v_node->'statement') IS DISTINCT FROM 'string' OR length(btrim(v_node->>'statement')) NOT BETWEEN 1 AND 20000
       OR v_node->>'state' NOT IN ('proposed','active')
       OR jsonb_typeof(v_node->'extendsRefs') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_node->'researchContract') IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_node#>'{researchContract,problem}') IS DISTINCT FROM 'string'
       OR btrim(v_node#>>'{researchContract,problem}') = ''
       OR jsonb_typeof(v_node#>'{researchContract,scope}') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_node#>'{researchContract,scope}') < 1
       OR jsonb_typeof(v_node#>'{researchContract,falsification}') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_node#>'{researchContract,falsification}') < 1 THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] Question fields are invalid' USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.assert_typed_research_text_array(v_node->'topics','topics');
    PERFORM private.assert_typed_research_text_array(v_node#>'{researchContract,scope}','researchContract.scope');
    PERFORM private.assert_typed_research_text_array(v_node#>'{researchContract,falsification}','researchContract.falsification');
    IF jsonb_array_length(v_node->'topics') > 8 THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] at most 8 topics' USING ERRCODE = 'P0001';
    END IF;
    v_target := jsonb_build_object('kind','question','id',v_node->>'questionId','revision',v_revision);
    IF v_revision > 1 THEN
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','supersedes',
        'source',jsonb_build_object('kind','question','id',v_node->>'questionId','revision',v_revision-1),'target',v_target));
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_node->'extendsRefs') AS item(value) LOOP
      v_ref := private.assert_typed_research_ref(v_item, ARRAY['question'], 'extendsRefs['||v_index::text||']');
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','extends_question','source',v_ref,'target',v_target));
      v_index := v_index + 1;
    END LOOP;
  ELSE
    IF NOT (v_node ?& ARRAY['claimId','projectId','revision','supersedesRevision','state','questionId','statement','scope','assumptions','falsification','answerRef','relations'])
       OR (v_node - ARRAY['claimId','projectId','revision','supersedesRevision','state','questionId','statement','scope','assumptions','falsification','answerRef','relations']::text[]) <> '{}'::jsonb
       OR jsonb_typeof(v_node->'claimId') IS DISTINCT FROM 'string' OR btrim(v_node->>'claimId') = '' OR length(v_node->>'claimId') > 200
       OR NOT (jsonb_typeof(v_node->'questionId') = 'null' OR (jsonb_typeof(v_node->'questionId') = 'string' AND btrim(v_node->>'questionId') <> ''))
       OR jsonb_typeof(v_node->'statement') IS DISTINCT FROM 'string' OR length(btrim(v_node->>'statement')) NOT BETWEEN 1 AND 20000
       OR jsonb_typeof(v_node->'falsification') IS DISTINCT FROM 'array' OR jsonb_array_length(v_node->'falsification') < 1
       OR jsonb_typeof(v_node->'scope') IS DISTINCT FROM 'array' OR jsonb_array_length(v_node->'scope') < 1
       OR v_node->>'state' IS DISTINCT FROM 'hypothesis'
       OR jsonb_typeof(v_node->'relations') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_node->'answerRef') NOT IN ('null','object') THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] Claim fields are invalid (new claims start as hypothesis)' USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.assert_typed_research_text_array(v_node->'scope','scope');
    PERFORM private.assert_typed_research_text_array(v_node->'assumptions','assumptions');
    PERFORM private.assert_typed_research_text_array(v_node->'falsification','falsification');
    v_target := jsonb_build_object('kind','claim','id',v_node->>'claimId','revision',v_revision);
    IF v_revision > 1 THEN
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','supersedes',
        'source',jsonb_build_object('kind','claim','id',v_node->>'claimId','revision',v_revision-1),'target',v_target));
    END IF;
    IF jsonb_typeof(v_node->'answerRef') = 'object' THEN
      v_ref := private.assert_typed_research_ref(v_node->'answerRef', ARRAY['answer'], 'answerRef');
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','yields_claim','source',v_ref,'target',v_target));
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_node->'relations') AS item(value) LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' OR NOT (v_item ?& ARRAY['type','source'])
         OR (v_item - ARRAY['type','source']::text[]) <> '{}'::jsonb THEN
        RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] relations[%] must be {type, source}', v_index USING ERRCODE = 'P0001';
      END IF;
      v_relation := v_item->>'type';
      IF v_relation IN ('derived_from','extends','implements') THEN
        v_ref := private.assert_typed_research_ref(v_item->'source', ARRAY['claim'], 'relations['||v_index::text||'].source');
      ELSIF v_relation = 'uses_dataset' THEN
        v_ref := private.assert_typed_research_ref(v_item->'source', ARRAY['dataset','claim'], 'relations['||v_index::text||'].source');
      ELSIF v_relation = 'uses_tool' THEN
        v_ref := private.assert_typed_research_ref(v_item->'source', ARRAY['tool','claim'], 'relations['||v_index::text||'].source');
      ELSE
        RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] relations[%] type must be derived_from, extends, implements, uses_dataset or uses_tool', v_index USING ERRCODE = 'P0001';
      END IF;
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type',v_relation,'source',v_ref,'target',v_target));
      v_index := v_index + 1;
    END LOOP;
  END IF;

  SELECT count(*)::integer, count(DISTINCT value)::integer INTO v_count, v_unique_count
  FROM jsonb_array_elements(v_edges) AS edge(value);
  IF v_count IS DISTINCT FROM v_unique_count THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_EDGE_SET_INVALID] derived incoming edges are not unique' USING ERRCODE = 'P0001';
  END IF;
  IF p_payload->'incomingEdges' IS DISTINCT FROM v_edges THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_EDGE_SET_MISMATCH] signed incoming edges must exactly equal the server-derived motif' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_edges;
END
$$;
--> statement-breakpoint
-- Question/Claim submit. Mirrors private.execute_typed_research_submit's
-- verification order exactly; differs only in the per-kind projection.
CREATE OR REPLACE FUNCTION private.execute_typed_research_submit_reasoning(
  p_agent_actor_id text,
  p_signature_envelope jsonb,
  p_platform_event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb := p_signature_envelope->'payload';
  v_node jsonb;
  v_event_payload jsonb;
  v_expected_edges jsonb;
  v_kind text;
  v_node_id text;
  v_project_id text;
  v_publisher_actor_id text;
  v_key_id text;
  v_nonce text;
  v_submission_hash text;
  v_canonical_payload_hash text;
  v_revision integer;
  v_supersedes integer;
  v_expected_event_type text;
  v_event_id text;
  v_created_at timestamptz;
  v_commit_rank bigint;
  v_label text;
  v_role text;
  v_agent record;
  v_publisher record;
  v_key record;
  v_project record;
  v_stable record;
  v_previous_revision integer;
  v_source record;
  v_edge jsonb;
  v_source_ref jsonb;
  v_edge_index integer;
  v_edge_ids jsonb := '[]'::jsonb;
  v_edge_id text;
  v_receipt_id uuid;
  v_result jsonb;
  v_existing_receipt record;
  v_inserted integer;
  v_question_id text;
  v_question_project text;
  v_contract jsonb;
  v_contract_id text;
BEGIN
  p_agent_actor_id := btrim(p_agent_actor_id);
  IF p_agent_actor_id IS NULL OR p_agent_actor_id = '' OR length(p_agent_actor_id) > 500
     OR jsonb_typeof(p_signature_envelope) IS DISTINCT FROM 'object'
     OR NOT (p_signature_envelope ?& ARRAY['schema','event_type','payload','nonce','signing_bytes_hash','signature'])
     OR (p_signature_envelope - ARRAY['schema','event_type','payload','nonce','signing_bytes_hash','signature']::text[]) <> '{}'::jsonb
     OR p_signature_envelope->>'schema' IS DISTINCT FROM 'srp.client-signature-envelope.v1'
     OR jsonb_typeof(v_payload) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_signature_envelope->'signature') IS DISTINCT FROM 'object'
     OR NOT ((p_signature_envelope->'signature') ?& ARRAY['algorithm','key_id','value'])
     OR ((p_signature_envelope->'signature') - ARRAY['algorithm','key_id','value']::text[]) <> '{}'::jsonb
     OR p_signature_envelope#>>'{signature,algorithm}' IS DISTINCT FROM 'Ed25519'
     OR btrim(COALESCE(p_signature_envelope#>>'{signature,key_id}','')) = ''
     OR btrim(COALESCE(p_signature_envelope#>>'{signature,value}','')) = ''
     OR p_signature_envelope->>'nonce' !~ '^[A-Za-z0-9_-]{16,128}$'
     OR p_signature_envelope->>'signing_bytes_hash' !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_ENVELOPE_INVALID] complete canonical Ed25519 signature envelope required' USING ERRCODE = 'P0001';
  END IF;
  v_key_id := btrim(p_signature_envelope#>>'{signature,key_id}');
  v_nonce := p_signature_envelope->>'nonce';
  v_submission_hash := p_signature_envelope->>'signing_bytes_hash';

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_agent_actor_id || chr(31) || v_key_id || chr(31) || v_nonce, 0)
  );
  SELECT submission_hash,result INTO v_existing_receipt
  FROM private.research_submission_receipts
  WHERE agent_actor_id=p_agent_actor_id AND key_id=v_key_id AND nonce=v_nonce;
  IF FOUND THEN
    IF v_existing_receipt.submission_hash IS DISTINCT FROM v_submission_hash THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_REPLAY_CONFLICT] nonce is already bound to different signed bytes' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_existing_receipt.result;
  END IF;

  v_expected_edges := private.derive_typed_research_incoming_edges_v2(v_payload);
  v_kind := v_payload->>'entityType';
  v_node := v_payload->'node';
  v_node_id := v_node->>(v_kind || 'Id');
  v_project_id := v_node->>'projectId';
  v_revision := (v_node->>'revision')::integer;
  v_supersedes := CASE WHEN v_revision=1 THEN NULL ELSE v_revision-1 END;
  v_publisher_actor_id := v_payload->>'publisherActorId';
  v_expected_event_type := v_kind || CASE WHEN v_revision=1 THEN '.created' ELSE '.revised' END;
  IF p_signature_envelope->>'event_type' IS DISTINCT FROM v_expected_event_type
     OR v_payload->>'producerActorId' IS DISTINCT FROM p_agent_actor_id
     OR v_payload->>'draftedByActorId' IS DISTINCT FROM p_agent_actor_id
     OR v_payload->>'signerActorId' IS DISTINCT FROM v_publisher_actor_id THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_ATTRIBUTION_INVALID] envelope must bind the producing Agent and its Human publisher/signer' USING ERRCODE = 'P0001';
  END IF;

  SELECT actor_type,owner_actor_id,deleted_at INTO v_agent FROM public.actors WHERE actor_id=p_agent_actor_id FOR SHARE;
  IF NOT FOUND OR v_agent.actor_type IS DISTINCT FROM 'agent'::public.actor_type
     OR v_agent.owner_actor_id IS NULL OR v_agent.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_AGENT_INVALID] active Agent actor required' USING ERRCODE = 'P0001';
  END IF;
  IF v_agent.owner_actor_id IS DISTINCT FROM v_publisher_actor_id THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PUBLISHER_OWNERSHIP_MISMATCH] publisher must be the Agent owner' USING ERRCODE = 'P0001';
  END IF;
  SELECT actor_type,deleted_at INTO v_publisher FROM public.actors WHERE actor_id=v_publisher_actor_id FOR SHARE;
  IF NOT FOUND OR v_publisher.actor_type NOT IN ('human'::public.actor_type,'maintainer'::public.actor_type)
     OR v_publisher.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PUBLISHER_INVALID] active Human publisher required' USING ERRCODE = 'P0001';
  END IF;
  SELECT key_id,actor_id,algorithm,revoked_at,deleted_at INTO v_key FROM public.signing_keys WHERE key_id=v_key_id FOR SHARE;
  IF NOT FOUND OR v_key.actor_id IS DISTINCT FROM v_publisher_actor_id OR v_key.algorithm IS DISTINCT FROM 'Ed25519'
     OR v_key.revoked_at IS NOT NULL OR v_key.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_SIGNING_KEY_INVALID] envelope key must be the Human publisher exact active Ed25519 key' USING ERRCODE = 'P0001';
  END IF;
  SELECT state,deleted_at,license INTO v_project FROM public.projects WHERE project_id=v_project_id FOR SHARE;
  IF NOT FOUND OR v_project.state IS DISTINCT FROM 'active'::public.project_state OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PROJECT_INVALID] active project required' USING ERRCODE = 'P0001';
  END IF;
  SELECT role INTO v_role FROM public.project_members
  WHERE project_id=v_project_id AND actor_id=p_agent_actor_id AND status='active' AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND OR v_role NOT IN ('owner','maintainer','contributor') THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PROJECT_ROLE_FORBIDDEN] Agent requires an active contributor-or-higher project membership' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_platform_event) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_platform_event->'payload') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_platform_event->'signature') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_platform_event->'parents') IS DISTINCT FROM 'array'
     OR p_platform_event#>>'{signature,algorithm}' IS DISTINCT FROM 'Ed25519'
     OR btrim(COALESCE(p_platform_event#>>'{signature,key_id}','')) = ''
     OR btrim(COALESCE(p_platform_event#>>'{signature,value}','')) = '' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PLATFORM_EVENT_INVALID] complete platform-signed ResearchEvent required' USING ERRCODE = 'P0001';
  END IF;
  v_event_payload := p_platform_event->'payload';
  IF (v_event_payload - ARRAY[
       'entity_type','entity_id','project_id','revision','supersedes_revision','actor_id',
       'producer_actor_id','drafted_by_actor_id','publisher_actor_id','signer_actor_id',
       'signing_key_id','nonce','publisher_signature_envelope','graph_version',
       'canonical_content_hash','typed_document','incoming_edges',
       'question_id','claim_id'
     ]::text[]) <> '{}'::jsonb
     OR v_event_payload->>'entity_type' IS DISTINCT FROM v_kind
     OR v_event_payload->>'entity_id' IS DISTINCT FROM v_node_id
     OR v_event_payload->>(v_kind || '_id') IS DISTINCT FROM v_node_id
     OR v_event_payload->>'project_id' IS DISTINCT FROM v_project_id
     OR v_event_payload->>'revision' IS DISTINCT FROM v_revision::text
     OR (CASE WHEN v_supersedes IS NULL THEN jsonb_typeof(v_event_payload->'supersedes_revision') IS DISTINCT FROM 'null'
              ELSE v_event_payload->>'supersedes_revision' IS DISTINCT FROM v_supersedes::text END)
     OR v_event_payload->>'actor_id' IS DISTINCT FROM p_agent_actor_id
     OR v_event_payload->>'producer_actor_id' IS DISTINCT FROM p_agent_actor_id
     OR v_event_payload->>'drafted_by_actor_id' IS DISTINCT FROM p_agent_actor_id
     OR v_event_payload->>'publisher_actor_id' IS DISTINCT FROM v_publisher_actor_id
     OR v_event_payload->>'signer_actor_id' IS DISTINCT FROM v_publisher_actor_id
     OR v_event_payload->>'signing_key_id' IS DISTINCT FROM v_key_id
     OR v_event_payload->>'nonce' IS DISTINCT FROM v_nonce
     OR v_event_payload->'publisher_signature_envelope' IS DISTINCT FROM p_signature_envelope
     OR v_event_payload->>'graph_version' IS DISTINCT FROM 'research-graph.v1'
     OR v_event_payload->>'canonical_content_hash' !~ '^sha256:[0-9a-f]{64}$'
     OR v_event_payload->'typed_document' IS DISTINCT FROM v_node
     OR v_event_payload->'incoming_edges' IS DISTINCT FROM v_expected_edges THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PLATFORM_EVENT_MISMATCH] platform event must exactly bind the rank-free signed mutation and attribution' USING ERRCODE = 'P0001';
  END IF;
  v_canonical_payload_hash := v_event_payload->>'canonical_content_hash';

  IF EXISTS (SELECT 1 FROM private.research_node_revisions WHERE node_kind=v_kind::private.research_node_kind AND node_id=v_node_id AND revision=v_revision) THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_TARGET_REVISION_EXISTS] target immutable revision already exists' USING ERRCODE = 'P0001';
  END IF;
  IF v_revision = 1 THEN
    IF EXISTS (SELECT 1 FROM private.research_nodes WHERE node_id=v_node_id)
       OR (v_kind='question' AND EXISTS (SELECT 1 FROM public.questions WHERE question_id=v_node_id))
       OR (v_kind='claim' AND EXISTS (SELECT 1 FROM public.claims WHERE claim_id=v_node_id)) THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_NODE_EXISTS] stable node id already exists' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT node_kind,project_id,retired_at INTO v_stable FROM private.research_nodes WHERE node_id=v_node_id FOR NO KEY UPDATE;
    IF NOT FOUND OR v_stable.node_kind IS DISTINCT FROM v_kind::private.research_node_kind
       OR v_stable.project_id IS DISTINCT FROM v_project_id OR v_stable.retired_at IS NOT NULL THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_NODE_IDENTITY_MISMATCH] active stable node identity/project required for revision' USING ERRCODE = 'P0001';
    END IF;
    SELECT max(revision)::integer INTO v_previous_revision FROM private.research_node_revisions
    WHERE node_kind=v_kind::private.research_node_kind AND node_id=v_node_id;
    IF v_previous_revision IS DISTINCT FROM v_supersedes THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_REVISION_RACE] revision must follow the current immutable revision' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_kind = 'claim' THEN
    v_question_id := NULLIF(v_node->>'questionId','');
    IF v_question_id IS NOT NULL THEN
      SELECT project_id INTO v_question_project FROM public.questions WHERE question_id=v_question_id AND deleted_at IS NULL;
      IF NOT FOUND OR v_question_project IS DISTINCT FROM v_project_id THEN
        RAISE EXCEPTION '[TYPED_RESEARCH_DANGLING_SOURCE] Claim question must exist in the same project' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  FOR v_edge_index,v_edge IN SELECT ordinality::integer,value FROM jsonb_array_elements(v_expected_edges) WITH ORDINALITY AS edge(value,ordinality) LOOP
    v_source_ref := v_edge->'source';
    SELECT node.project_id INTO v_source
    FROM private.research_node_revisions AS revision
    JOIN private.research_nodes AS node ON node.node_kind=revision.node_kind AND node.node_id=revision.node_id
    WHERE revision.node_kind=(v_source_ref->>'kind')::private.research_node_kind
      AND revision.node_id=v_source_ref->>'id' AND revision.revision=(v_source_ref->>'revision')::integer;
    IF NOT FOUND OR v_source.project_id IS DISTINCT FROM v_project_id THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_DANGLING_SOURCE] every signed edge source must be an exact revision in the target project' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  v_event_id := private.persist_verified_research_event(p_platform_event,v_expected_event_type,p_agent_actor_id);
  SELECT created_at INTO STRICT v_created_at FROM public.research_events WHERE event_id=v_event_id;

  INSERT INTO public.signature_nonces (actor_id,key_id,nonce,consumed_at)
  VALUES (v_publisher_actor_id,v_key_id,v_nonce,v_created_at) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> 1 THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_SIGNATURE_REPLAYED] signature nonce was previously consumed without this immutable receipt' USING ERRCODE = 'P0001';
  END IF;

  -- Legacy projection the Web reads today. created_by is the producing Agent;
  -- the Human publisher/signer is bound in the platform event and receipt.
  IF v_kind = 'question' THEN
    v_label := v_node->>'title';
    -- The question revision references an immutable contract revision; the
    -- contract body lives in research_contract_revisions (the read model the
    -- question detail and verification flows already use). Fields the signed
    -- document omits get explicit, empty defaults, never invented content.
    v_contract := v_node->'researchContract';
    v_contract_id := 'contract_' || v_node_id;
    IF v_revision = 1 THEN
      INSERT INTO public.research_contracts (contract_id,created_by,created_at,updated_at)
      VALUES (v_contract_id,p_agent_actor_id,v_created_at,v_created_at);
    END IF;
    INSERT INTO public.research_contract_revisions (contract_id,revision,supersedes,problem,definitions,background,scope,exclusions,
      progress_criteria,acceptable_evidence,falsification,license,risk_level,maintainer_ids,created_by,created_at)
    VALUES (v_contract_id,v_revision,v_supersedes,v_contract->>'problem',COALESCE(v_contract->'definitions','{}'::jsonb),
      COALESCE(v_contract->>'background',''),v_contract->'scope',COALESCE(v_contract->'exclusions','[]'::jsonb),
      COALESCE(v_contract->'progress_criteria','[]'::jsonb),COALESCE(v_contract->'acceptable_evidence','[]'::jsonb),
      v_contract->'falsification',COALESCE(v_contract->>'license',v_project.license,'unspecified'),'open',
      jsonb_build_array(v_publisher_actor_id),p_agent_actor_id,v_created_at);
    IF v_revision = 1 THEN
      INSERT INTO public.questions (question_id,project_id,state,created_by,created_at,updated_at,topics)
      VALUES (v_node_id,v_project_id,(v_node->>'state')::public.question_state,p_agent_actor_id,v_created_at,v_created_at,
        ARRAY(SELECT value FROM jsonb_array_elements_text(v_node->'topics') AS item(value)));
    ELSE
      UPDATE public.questions SET state=(v_node->>'state')::public.question_state, updated_at=v_created_at,
        topics=ARRAY(SELECT value FROM jsonb_array_elements_text(v_node->'topics') AS item(value))
      WHERE question_id=v_node_id;
    END IF;
    INSERT INTO public.question_revisions (question_id,revision,supersedes,state,title,statement,research_contract,created_by,created_at)
    VALUES (v_node_id,v_revision,v_supersedes,(v_node->>'state')::public.question_state,v_node->>'title',v_node->>'statement',
      jsonb_build_object('contractId',v_contract_id,'revision',v_revision),p_agent_actor_id,v_created_at);
  ELSE
    v_label := v_node->>'statement';
    IF v_revision = 1 THEN
      INSERT INTO public.claims (claim_id,question_id,state,created_by,created_at,updated_at)
      VALUES (v_node_id,v_question_id,'hypothesis',p_agent_actor_id,v_created_at,v_created_at);
    ELSE
      UPDATE public.claims SET updated_at=v_created_at WHERE claim_id=v_node_id;
    END IF;
    INSERT INTO public.claim_revisions (claim_id,revision,supersedes,state,statement,scope,assumptions,falsification,question_id,created_by,created_at)
    SELECT v_node_id,v_revision,v_supersedes,claim.state,v_node->>'statement',v_node->'scope',v_node->'assumptions',
      v_node->'falsification',v_question_id,p_agent_actor_id,v_created_at
    FROM public.claims AS claim WHERE claim.claim_id=v_node_id;
  END IF;

  -- Kernel graph.
  v_commit_rank := nextval('private.research_commit_rank_seq');
  IF v_revision = 1 THEN
    INSERT INTO private.research_nodes (node_id,node_kind,project_id,created_by,created_at)
    VALUES (v_node_id,v_kind::private.research_node_kind,v_project_id,p_agent_actor_id,v_created_at);
  END IF;
  INSERT INTO private.research_node_revisions (
    node_kind,node_id,revision,supersedes_revision,commit_rank,batch_rank,
    canonical_content_hash,label,state,canonical_href,source_event_id,created_by,created_at
  ) VALUES (
    v_kind::private.research_node_kind,v_node_id,v_revision,v_supersedes,v_commit_rank,1,
    v_canonical_payload_hash,left(v_label,500),'published'::private.research_document_state,
    '/' || v_kind || 's/' || v_node_id,v_event_id,p_agent_actor_id,v_created_at
  );
  FOR v_edge_index,v_edge IN SELECT ordinality::integer,value FROM jsonb_array_elements(v_expected_edges) WITH ORDINALITY AS edge(value,ordinality) LOOP
    v_source_ref := v_edge->'source';
    SELECT revision.commit_rank,revision.batch_rank INTO STRICT v_source
    FROM private.research_node_revisions AS revision
    WHERE revision.node_kind=(v_source_ref->>'kind')::private.research_node_kind
      AND revision.node_id=v_source_ref->>'id' AND revision.revision=(v_source_ref->>'revision')::integer;
    v_edge_id := 'typed_edge:' || v_event_id || ':' || v_edge_index::text;
    INSERT INTO private.research_edges (
      edge_id,edge_type,source_kind,source_id,source_revision,source_commit_rank,source_batch_rank,
      target_kind,target_id,target_revision,target_commit_rank,target_batch_rank,provenance_event_id,created_by,created_at
    ) VALUES (
      v_edge_id,(v_edge->>'type')::private.research_edge_type,
      (v_source_ref->>'kind')::private.research_node_kind,v_source_ref->>'id',(v_source_ref->>'revision')::integer,
      v_source.commit_rank,v_source.batch_rank,v_kind::private.research_node_kind,v_node_id,v_revision,
      v_commit_rank,1,v_event_id,p_agent_actor_id,v_created_at
    );
    v_edge_ids := v_edge_ids || jsonb_build_array(v_edge_id);
    -- Claim to Claim relations are also mirrored to the legacy claim_relations
    -- table and its crosswalk, so the Argument view and claim graph show them.
    IF v_kind = 'claim' AND v_source_ref->>'kind' = 'claim' AND v_edge->>'type' IN ('derived_from','extends','implements','uses_dataset','uses_tool') THEN
      INSERT INTO public.claim_relations (source_claim_id,target_claim_id,relation_type,created_by,created_at,updated_at)
      VALUES (v_source_ref->>'id', v_node_id,
        (CASE v_edge->>'type' WHEN 'uses_tool' THEN 'uses_method' ELSE v_edge->>'type' END)::public.claim_relation_type,
        p_agent_actor_id, v_created_at, v_created_at)
      ON CONFLICT DO NOTHING;
      PERFORM private.insert_research_graph_dual_write_relation_crosswalk(
        'typed_claim_relation:' || v_edge_id, v_project_id, 'claim_relation'::private.legacy_relation_source,
        (v_source_ref->>'id') || '>' || v_node_id || ':' || (v_edge->>'type'),
        jsonb_build_object('sourceClaimId', v_source_ref->>'id', 'sourceRevision', (v_source_ref->>'revision')::integer,
          'targetClaimId', v_node_id, 'targetRevision', v_revision,
          'relationType', CASE v_edge->>'type' WHEN 'uses_tool' THEN 'uses_method' ELSE v_edge->>'type' END),
        p_platform_event->>'hash', 'direct'::private.legacy_mapping_kind, NULL, NULL, NULL, v_edge_id
      );
    END IF;
  END LOOP;

  INSERT INTO private.legacy_node_records (
    mapping_id,project_id,source_kind,source_id,source_revision,source_payload,source_checksum,status,
    mapped_node_kind,mapped_node_id,mapped_node_revision,source_event_id,created_at
  ) VALUES (
    'typed_node:'||v_event_id,v_project_id,v_kind::private.research_node_kind,v_node_id,v_revision,
    v_payload,v_canonical_payload_hash,'mapped',v_kind::private.research_node_kind,v_node_id,v_revision,v_event_id,v_created_at
  );

  v_receipt_id := extensions.gen_random_uuid();
  v_result := jsonb_build_object(
    'schema','evimesh.typed-research-submit-result.v1',
    'receiptId',v_receipt_id,
    'eventId',v_event_id,
    'node',jsonb_build_object('kind',v_kind,'id',v_node_id,'revision',v_revision,'projectId',v_project_id),
    'edgeIds',v_edge_ids,
    'canonicalContentHash',v_canonical_payload_hash,
    'createdAt',to_char(v_created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
  INSERT INTO private.research_submission_receipts (
    receipt_id,agent_actor_id,publisher_actor_id,key_id,nonce,submission_hash,canonical_payload_hash,
    project_id,node_kind,node_id,revision,event_id,result,created_at
  ) VALUES (
    v_receipt_id,p_agent_actor_id,v_publisher_actor_id,v_key_id,v_nonce,v_submission_hash,v_canonical_payload_hash,
    v_project_id,v_kind::private.research_node_kind,v_node_id,v_revision,v_event_id,v_result,v_created_at
  );
  RETURN v_result;
END
$$;
--> statement-breakpoint
-- Public dispatcher keeps the existing RPC name and signature.
CREATE OR REPLACE FUNCTION public.execute_typed_research_submit(
  p_agent_actor_id text,
  p_signature_envelope jsonb,
  p_platform_event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_SERVICE_ROLE_REQUIRED] service role is required' USING ERRCODE = '42501';
  END IF;
  IF p_signature_envelope #>> '{payload,entityType}' IN ('question','claim') THEN
    RETURN private.execute_typed_research_submit_reasoning(p_agent_actor_id,p_signature_envelope,p_platform_event);
  END IF;
  RETURN private.execute_typed_research_submit(p_agent_actor_id,p_signature_envelope,p_platform_event);
END
$$;
--> statement-breakpoint

-- -------------------------------------------------------------- privileges
REVOKE ALL ON FUNCTION private.managed_agent_create(text,text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.managed_agent_retire(text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.project_agent_enroll(text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.project_agent_remove(text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.derive_typed_research_incoming_edges_v2(jsonb) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.execute_typed_research_submit_reasoning(text,jsonb,jsonb) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.managed_agent_create(text,text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.managed_agent_retire(text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.project_agent_enroll(text,text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.project_agent_remove(text,text,text) FROM PUBLIC;--> statement-breakpoint
DO $agent_grants$
DECLARE
  v_role text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=v_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION private.managed_agent_create(text,text,text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION private.managed_agent_retire(text,text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION private.project_agent_enroll(text,text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION private.project_agent_remove(text,text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION private.derive_typed_research_incoming_edges_v2(jsonb) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION private.execute_typed_research_submit_reasoning(text,jsonb,jsonb) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.managed_agent_create(text,text,text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.managed_agent_retire(text,text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.project_agent_enroll(text,text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.project_agent_remove(text,text,text) FROM %I', v_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
    GRANT USAGE ON SCHEMA private TO service_role;
    GRANT EXECUTE ON FUNCTION private.managed_agent_create(text,text,text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION private.managed_agent_retire(text,text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION private.project_agent_enroll(text,text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION private.project_agent_remove(text,text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION private.derive_typed_research_incoming_edges_v2(jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION private.execute_typed_research_submit_reasoning(text,jsonb,jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.managed_agent_create(text,text,text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.managed_agent_retire(text,text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.project_agent_enroll(text,text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.project_agent_remove(text,text,text) TO service_role;
  END IF;
END
$agent_grants$;
--> statement-breakpoint

-- -------------------------------------------------- project applications
-- Read path for the application lifecycle. An applicant sees their own
-- applications; an active community steward also sees every pending one.
CREATE OR REPLACE FUNCTION private.project_application_list(p_viewer_actor_id text, p_scope text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_viewer text := pg_catalog.btrim(p_viewer_actor_id);
  v_is_steward boolean;
BEGIN
  IF p_scope NOT IN ('mine','pending') THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_SCOPE_INVALID] scope must be mine or pending' USING ERRCODE = '22023';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.actors WHERE actor_id = v_viewer AND actor_type = 'maintainer' AND deleted_at IS NULL) INTO v_is_steward;
  IF p_scope = 'pending' AND NOT v_is_steward THEN
    RAISE EXCEPTION '[PROJECT_APPLICATION_STEWARD_FORBIDDEN] community steward authorization is required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'applicationId', application.application_id,
      'applicantActorId', application.applicant_actor_id,
      'proposedProjectId', application.proposed_project_id,
      'name', application.proposed_name,
      'summary', application.proposed_summary,
      'license', application.proposed_license,
      'status', application.status,
      'submittedAt', application.submitted_at,
      'decidedAt', application.decided_at,
      'decisionReason', application.decision_reason,
      'approvedProjectId', application.approved_project_id
    ) ORDER BY application.submitted_at DESC)
    FROM private.project_applications AS application
    WHERE (p_scope = 'mine' AND application.applicant_actor_id = v_viewer)
       OR (p_scope = 'pending' AND application.status = 'pending')
  ), '[]'::jsonb);
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.project_application_get(p_application_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'applicationId', application_id, 'applicantActorId', applicant_actor_id,
    'proposedProjectId', proposed_project_id, 'name', proposed_name, 'summary', proposed_summary,
    'license', proposed_license, 'status', status, 'submittedAt', submitted_at
  )
  FROM private.project_applications WHERE application_id = p_application_id
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.project_application_list(p_viewer_actor_id text, p_scope text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.project_application_list(p_viewer_actor_id, p_scope) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.project_application_get(p_application_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.project_application_get(p_application_id) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.project_application_list(text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.project_application_get(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.project_application_list(text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.project_application_get(uuid) FROM PUBLIC;--> statement-breakpoint
DO $application_grants$
DECLARE
  v_role text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=v_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION private.project_application_list(text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION private.project_application_get(uuid) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.project_application_list(text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.project_application_get(uuid) FROM %I', v_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
    GRANT EXECUTE ON FUNCTION private.project_application_list(text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION private.project_application_get(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.project_application_list(text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.project_application_get(uuid) TO service_role;
  END IF;
END
$application_grants$;
--> statement-breakpoint

-- ---------------------------------------------- membership read model
-- The roster of an open research project is public (who maintains it and
-- which Agents contribute, with the owning human). Invitations are private
-- to their recipient and to the project's owners and maintainers.
CREATE OR REPLACE FUNCTION private.project_member_list(p_project_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'actorId', member.actor_id,
    'role', member.role,
    'actorType', actor.actor_type,
    'ownerActorId', actor.owner_actor_id,
    'displayName', profile.display_name,
    'joinedAt', member.joined_at
  ) ORDER BY CASE member.role WHEN 'owner' THEN 0 WHEN 'maintainer' THEN 1 WHEN 'contributor' THEN 2 ELSE 3 END, member.joined_at), '[]'::jsonb)
  FROM public.project_members AS member
  JOIN public.actors AS actor ON actor.actor_id = member.actor_id
  LEFT JOIN public.actor_profiles AS profile ON profile.actor_id = member.actor_id AND profile.deleted_at IS NULL
  WHERE member.project_id = pg_catalog.btrim(p_project_id) AND member.status = 'active' AND member.deleted_at IS NULL
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.project_invitation_list(p_viewer_actor_id text, p_project_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_viewer text := pg_catalog.btrim(p_viewer_actor_id);
  v_project text := NULLIF(pg_catalog.btrim(COALESCE(p_project_id,'')),'');
BEGIN
  IF v_project IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project AND actor_id = v_viewer AND status = 'active' AND role IN ('owner','maintainer')
  ) THEN
    RAISE EXCEPTION '[PROJECT_INVITATION_LIST_FORBIDDEN] only project owners and maintainers list its invitations' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'invitationId', invitation.invitation_id,
      'projectId', invitation.project_id,
      'projectName', revision.name,
      'invitedActorId', invitation.invited_actor_id,
      'invitedDisplayName', invited.display_name,
      'invitedByActorId', invitation.invited_by_actor_id,
      'invitedByDisplayName', inviter.display_name,
      'role', invitation.role,
      'status', CASE WHEN invitation.status = 'pending' AND invitation.expires_at <= pg_catalog.now() THEN 'expired' ELSE invitation.status END,
      'createdAt', invitation.created_at,
      'expiresAt', invitation.expires_at
    ) ORDER BY invitation.created_at DESC)
    FROM private.project_invitations AS invitation
    LEFT JOIN public.actor_profiles AS invited ON invited.actor_id = invitation.invited_actor_id
    LEFT JOIN public.actor_profiles AS inviter ON inviter.actor_id = invitation.invited_by_actor_id
    LEFT JOIN LATERAL (
      SELECT name FROM public.project_revisions
      WHERE project_id = invitation.project_id ORDER BY revision DESC LIMIT 1
    ) AS revision ON true
    WHERE (v_project IS NULL AND invitation.invited_actor_id = v_viewer)
       OR (v_project IS NOT NULL AND invitation.project_id = v_project)
  ), '[]'::jsonb);
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.project_member_list(p_project_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.project_member_list(p_project_id) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.project_invitation_list(p_viewer_actor_id text, p_project_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.project_invitation_list(p_viewer_actor_id, p_project_id) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.project_member_list(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.project_invitation_list(text,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.project_member_list(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.project_invitation_list(text,text) FROM PUBLIC;--> statement-breakpoint
DO $membership_read_grants$
DECLARE
  v_role text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=v_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION private.project_member_list(text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION private.project_invitation_list(text,text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.project_member_list(text) FROM %I', v_role);
      EXECUTE format('REVOKE ALL ON FUNCTION public.project_invitation_list(text,text) FROM %I', v_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
    GRANT EXECUTE ON FUNCTION private.project_member_list(text) TO service_role;
    GRANT EXECUTE ON FUNCTION private.project_invitation_list(text,text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.project_member_list(text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.project_invitation_list(text,text) TO service_role;
  END IF;
END
$membership_read_grants$;
--> statement-breakpoint

-- Public profile fields (display name, bio, avatar) are what the public
-- contributor page and every attribution chain render. Writes stay limited to
-- the owner by the existing policies.
DROP POLICY IF EXISTS "public_read_actor_profiles" ON "public"."actor_profiles";--> statement-breakpoint
CREATE POLICY "public_read_actor_profiles" ON "public"."actor_profiles"
  FOR SELECT TO "anon", "authenticated"
  USING ("deleted_at" IS NULL);--> statement-breakpoint
GRANT SELECT ON TABLE "public"."actor_profiles" TO "anon";
