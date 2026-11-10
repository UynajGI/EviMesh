CREATE TABLE "private"."research_submission_receipts" (
	"receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_actor_id" text NOT NULL,
	"publisher_actor_id" text NOT NULL,
	"key_id" text NOT NULL,
	"nonce" text NOT NULL,
	"submission_hash" text NOT NULL,
	"canonical_payload_hash" text NOT NULL,
	"project_id" text NOT NULL,
	"node_kind" "private"."research_node_kind" NOT NULL,
	"node_id" text NOT NULL,
	"revision" integer NOT NULL,
	"event_id" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_submission_receipts_nonce_shape" CHECK ("private"."research_submission_receipts"."nonce" ~ '^[A-Za-z0-9_-]{16,128}$'),
	CONSTRAINT "research_submission_receipts_submission_hash_shape" CHECK ("private"."research_submission_receipts"."submission_hash" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "research_submission_receipts_payload_hash_shape" CHECK ("private"."research_submission_receipts"."canonical_payload_hash" ~ '^sha256:[0-9a-f]{64}$'),
	CONSTRAINT "research_submission_receipts_revision_positive" CHECK ("private"."research_submission_receipts"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "private"."research_submission_receipts" ADD CONSTRAINT "research_submission_receipts_agent_actor_id_actors_actor_id_fk" FOREIGN KEY ("agent_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_submission_receipts" ADD CONSTRAINT "research_submission_receipts_publisher_actor_id_actors_actor_id_fk" FOREIGN KEY ("publisher_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_submission_receipts" ADD CONSTRAINT "research_submission_receipts_key_id_signing_keys_key_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."signing_keys"("key_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_submission_receipts" ADD CONSTRAINT "research_submission_receipts_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_submission_receipts" ADD CONSTRAINT "research_submission_receipts_node_revision_fk" FOREIGN KEY ("node_kind","node_id","revision") REFERENCES "private"."research_node_revisions"("node_kind","node_id","revision") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_submission_receipts" ADD CONSTRAINT "research_submission_receipts_event_id_research_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."research_events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."research_submission_receipts" ADD CONSTRAINT "research_submission_receipts_consumed_nonce_fk" FOREIGN KEY ("publisher_actor_id","key_id","nonce") REFERENCES "public"."signature_nonces"("actor_id","key_id","nonce") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "research_submission_receipts_agent_key_nonce_unique" ON "private"."research_submission_receipts" USING btree ("agent_actor_id","key_id","nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "research_submission_receipts_event_unique" ON "private"."research_submission_receipts" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_submission_receipts_revision_unique" ON "private"."research_submission_receipts" USING btree ("node_kind","node_id","revision");--> statement-breakpoint
CREATE INDEX "research_submission_receipts_project_created_idx" ON "private"."research_submission_receipts" USING btree ("project_id","created_at");
--> statement-breakpoint
CREATE TRIGGER research_submission_receipts_append_only_trigger
BEFORE UPDATE OR DELETE ON private.research_submission_receipts
FOR EACH ROW EXECUTE FUNCTION private.prevent_research_graph_mutation();
--> statement-breakpoint
ALTER TABLE private.research_submission_receipts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE private.research_submission_receipts FROM PUBLIC;
--> statement-breakpoint
-- Validate a normalized array of unique, non-empty strings. JSON values are
-- never re-serialized for hashing in PostgreSQL; canonical hashes are supplied
-- by the JavaScript canonicalizer and bound by the platform-signed event.
CREATE OR REPLACE FUNCTION private.assert_typed_research_text_array(
  p_value jsonb,
  p_field text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_unique_count integer;
BEGIN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] % must be an array', p_field
      USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*)::integer, count(DISTINCT value)::integer
    INTO v_count, v_unique_count
  FROM jsonb_array_elements(p_value) AS item(value)
  WHERE jsonb_typeof(value) = 'string'
    AND value #>> '{}' = btrim(value #>> '{}')
    AND value #>> '{}' <> '';
  IF v_count IS DISTINCT FROM jsonb_array_length(p_value)
     OR v_unique_count IS DISTINCT FROM v_count THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] % must contain unique non-empty canonical strings', p_field
      USING ERRCODE = 'P0001';
  END IF;
END
$$;
--> statement-breakpoint
-- Forward declarations keep all callable signatures present before the
-- privilege revocation block. The complete immutable implementations replace
-- these declarations later in this migration before any caller can execute.
CREATE OR REPLACE FUNCTION private.assert_typed_research_ref(
  p_ref jsonb,
  p_allowed_kinds text[],
  p_field text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '[TYPED_RESEARCH_MIGRATION_INCOMPLETE] ref validator is not installed'
    USING ERRCODE = 'P0001';
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.derive_typed_research_incoming_edges(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '[TYPED_RESEARCH_MIGRATION_INCOMPLETE] motif derivation is not installed'
    USING ERRCODE = 'P0001';
END
$$;
--> statement-breakpoint
-- Trust boundary: the Hosted adapter verifies the Human Ed25519 envelope and
-- the platform event signature before entering this RPC. PostgreSQL accepts
-- only that already-verified event, then independently revalidates its exact
-- canonical bindings, live actors/key/role, nonce, motif, and atomic writes.
CREATE OR REPLACE FUNCTION private.execute_typed_research_submit(
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
  v_payload jsonb;
  v_node jsonb;
  v_event_payload jsonb;
  v_expected_edges jsonb;
  v_kind text;
  v_id_field text;
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
  v_batch_rank integer := 1;
  v_label text;
  v_href text;
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
  v_basis jsonb;
  v_receipt_id uuid;
  v_result jsonb;
  v_existing_receipt record;
  v_inserted integer;
BEGIN
  p_agent_actor_id := btrim(p_agent_actor_id);
  IF p_agent_actor_id IS NULL OR p_agent_actor_id = '' OR length(p_agent_actor_id) > 500
     OR jsonb_typeof(p_signature_envelope) IS DISTINCT FROM 'object'
     OR NOT (p_signature_envelope ?& ARRAY['schema','event_type','payload','nonce','signing_bytes_hash','signature'])
     OR (p_signature_envelope - ARRAY['schema','event_type','payload','nonce','signing_bytes_hash','signature']::text[]) <> '{}'::jsonb
     OR p_signature_envelope->>'schema' IS DISTINCT FROM 'srp.client-signature-envelope.v1'
     OR jsonb_typeof(p_signature_envelope->'payload') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_signature_envelope->'signature') IS DISTINCT FROM 'object'
     OR NOT ((p_signature_envelope->'signature') ?& ARRAY['algorithm','key_id','value'])
     OR ((p_signature_envelope->'signature') - ARRAY['algorithm','key_id','value']::text[]) <> '{}'::jsonb
     OR p_signature_envelope#>>'{signature,algorithm}' IS DISTINCT FROM 'Ed25519'
     OR jsonb_typeof(p_signature_envelope#>'{signature,key_id}') IS DISTINCT FROM 'string'
     OR btrim(p_signature_envelope#>>'{signature,key_id}') = ''
     OR jsonb_typeof(p_signature_envelope#>'{signature,value}') IS DISTINCT FROM 'string'
     OR btrim(p_signature_envelope#>>'{signature,value}') = ''
     OR p_signature_envelope->>'nonce' !~ '^[A-Za-z0-9_-]{16,128}$'
     OR p_signature_envelope->>'signing_bytes_hash' !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_ENVELOPE_INVALID] complete canonical Ed25519 signature envelope required'
      USING ERRCODE = 'P0001';
  END IF;
  v_payload := p_signature_envelope->'payload';
  v_key_id := btrim(p_signature_envelope#>>'{signature,key_id}');
  v_nonce := p_signature_envelope->>'nonce';
  v_submission_hash := p_signature_envelope->>'signing_bytes_hash';

  -- Serialize equal and conflicting retries before inspecting the immutable
  -- receipt. The advisory key is only a lock key, never a security hash.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_agent_actor_id || chr(31) || v_key_id || chr(31) || v_nonce, 0)
  );
  SELECT submission_hash,result
    INTO v_existing_receipt
  FROM private.research_submission_receipts
  WHERE agent_actor_id=p_agent_actor_id AND key_id=v_key_id AND nonce=v_nonce;
  IF FOUND THEN
    IF v_existing_receipt.submission_hash IS DISTINCT FROM v_submission_hash THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_REPLAY_CONFLICT] nonce is already bound to different signed bytes'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN v_existing_receipt.result;
  END IF;

  v_expected_edges := private.derive_typed_research_incoming_edges(v_payload);
  v_kind := v_payload->>'entityType';
  v_node := v_payload->'node';
  v_id_field := CASE v_kind
    WHEN 'answer' THEN 'answerId'
    WHEN 'rebuttal' THEN 'rebuttalId'
    WHEN 'evaluation' THEN 'evaluationId'
    WHEN 'dataset' THEN 'datasetId'
    WHEN 'tool' THEN 'toolId'
  END;
  v_node_id := v_node->>v_id_field;
  v_project_id := v_node->>'projectId';
  v_revision := (v_node->>'revision')::integer;
  v_supersedes := CASE WHEN v_revision=1 THEN NULL ELSE v_revision-1 END;
  v_publisher_actor_id := v_payload->>'publisherActorId';
  v_expected_event_type := v_kind || CASE WHEN v_revision=1 THEN '.created' ELSE '.revised' END;
  IF p_signature_envelope->>'event_type' IS DISTINCT FROM v_expected_event_type
     OR v_payload->>'producerActorId' IS DISTINCT FROM p_agent_actor_id
     OR v_payload->>'draftedByActorId' IS DISTINCT FROM p_agent_actor_id
     OR v_payload->>'signerActorId' IS DISTINCT FROM v_publisher_actor_id THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_ATTRIBUTION_INVALID] envelope must bind the producing Agent and its Human publisher/signer'
      USING ERRCODE = 'P0001';
  END IF;

  -- Shared row locks let unrelated submissions proceed concurrently while
  -- preventing owner/key/project/membership revocation during this mutation.
  SELECT actor_type,owner_actor_id,deleted_at
    INTO v_agent
  FROM public.actors
  WHERE actor_id=p_agent_actor_id
  FOR SHARE;
  IF NOT FOUND OR v_agent.actor_type IS DISTINCT FROM 'agent'::public.actor_type
     OR v_agent.owner_actor_id IS NULL OR v_agent.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_AGENT_INVALID] active Agent actor required'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_agent.owner_actor_id IS DISTINCT FROM v_publisher_actor_id THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PUBLISHER_OWNERSHIP_MISMATCH] publisher must be the Agent owner'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT actor_type,deleted_at
    INTO v_publisher
  FROM public.actors
  WHERE actor_id=v_publisher_actor_id
  FOR SHARE;
  IF NOT FOUND OR v_publisher.actor_type IS DISTINCT FROM 'human'::public.actor_type
     OR v_publisher.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PUBLISHER_INVALID] active Human publisher required'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT key_id,actor_id,algorithm,revoked_at,deleted_at
    INTO v_key
  FROM public.signing_keys
  WHERE key_id=v_key_id
  FOR SHARE;
  IF NOT FOUND OR v_key.actor_id IS DISTINCT FROM v_publisher_actor_id
     OR v_key.algorithm IS DISTINCT FROM 'Ed25519'
     OR v_key.revoked_at IS NOT NULL OR v_key.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_SIGNING_KEY_INVALID] envelope key must be the Human publisher exact active Ed25519 key'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT state,deleted_at
    INTO v_project
  FROM public.projects
  WHERE project_id=v_project_id
  FOR SHARE;
  IF NOT FOUND OR v_project.state IS DISTINCT FROM 'active'::public.project_state
     OR v_project.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PROJECT_INVALID] active project required'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT role
    INTO v_role
  FROM public.project_members
  WHERE project_id=v_project_id AND actor_id=p_agent_actor_id
    AND status='active' AND deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND OR v_role NOT IN ('owner','maintainer','contributor') THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PROJECT_ROLE_FORBIDDEN] Agent requires an active contributor-or-higher project membership'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_platform_event) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_platform_event->'payload') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_platform_event->'signature') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_platform_event->'parents') IS DISTINCT FROM 'array'
     OR p_platform_event#>>'{signature,algorithm}' IS DISTINCT FROM 'Ed25519'
     OR btrim(COALESCE(p_platform_event#>>'{signature,key_id}','')) = ''
     OR btrim(COALESCE(p_platform_event#>>'{signature,value}','')) = '' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PLATFORM_EVENT_INVALID] complete platform-signed ResearchEvent required'
      USING ERRCODE = 'P0001';
  END IF;
  v_event_payload := p_platform_event->'payload';
  IF NOT (v_event_payload ?& ARRAY[
       'entity_type','entity_id','project_id','revision','supersedes_revision','actor_id',
       'producer_actor_id','drafted_by_actor_id','publisher_actor_id','signer_actor_id',
       'signing_key_id','nonce','publisher_signature_envelope','graph_version',
       'canonical_content_hash','typed_document','incoming_edges'
     ])
     OR (v_event_payload - ARRAY[
       'entity_type','entity_id','project_id','revision','supersedes_revision','actor_id',
       'producer_actor_id','drafted_by_actor_id','publisher_actor_id','signer_actor_id',
       'signing_key_id','nonce','publisher_signature_envelope','graph_version',
       'canonical_content_hash','typed_document','incoming_edges'
     ]::text[]) <> '{}'::jsonb
     OR v_event_payload->>'entity_type' IS DISTINCT FROM v_kind
     OR v_event_payload->>'entity_id' IS DISTINCT FROM v_node_id
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
     OR v_event_payload->'incoming_edges' IS DISTINCT FROM v_expected_edges
     OR v_event_payload ?| ARRAY['commit_rank','batch_rank'] THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PLATFORM_EVENT_MISMATCH] platform event must exactly bind the rank-free signed mutation and attribution'
      USING ERRCODE = 'P0001';
  END IF;
  v_canonical_payload_hash := v_event_payload->>'canonical_content_hash';

  IF EXISTS (SELECT 1 FROM private.research_node_revisions WHERE node_kind=v_kind::private.research_node_kind AND node_id=v_node_id AND revision=v_revision) THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_TARGET_REVISION_EXISTS] target immutable revision already exists'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_revision = 1 THEN
    IF EXISTS (SELECT 1 FROM private.research_nodes WHERE node_id=v_node_id) THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_NODE_EXISTS] stable node id already exists'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT node_kind,project_id,retired_at
      INTO v_stable
    FROM private.research_nodes
    WHERE node_id=v_node_id
    FOR NO KEY UPDATE;
    IF NOT FOUND OR v_stable.node_kind IS DISTINCT FROM v_kind::private.research_node_kind
       OR v_stable.project_id IS DISTINCT FROM v_project_id OR v_stable.retired_at IS NOT NULL THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_NODE_IDENTITY_MISMATCH] active stable node identity/project required for revision'
        USING ERRCODE = 'P0001';
    END IF;
    SELECT max(revision)::integer INTO v_previous_revision
    FROM private.research_node_revisions
    WHERE node_kind=v_kind::private.research_node_kind AND node_id=v_node_id;
    IF v_previous_revision IS DISTINCT FROM v_supersedes THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_REVISION_RACE] revision must follow the current immutable revision'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Validate every exact source revision before consuming the nonce or writing
  -- any event. Sources and target must live in one project.
  FOR v_edge_index,v_edge IN
    SELECT ordinality::integer,value
    FROM jsonb_array_elements(v_expected_edges) WITH ORDINALITY AS edge(value,ordinality)
  LOOP
    v_source_ref := v_edge->'source';
    SELECT revision.commit_rank,revision.batch_rank,node.project_id
      INTO v_source
    FROM private.research_node_revisions AS revision
    JOIN private.research_nodes AS node
      ON node.node_kind=revision.node_kind AND node.node_id=revision.node_id
    WHERE revision.node_kind=(v_source_ref->>'kind')::private.research_node_kind
      AND revision.node_id=v_source_ref->>'id'
      AND revision.revision=(v_source_ref->>'revision')::integer;
    IF NOT FOUND OR v_source.project_id IS DISTINCT FROM v_project_id THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_DANGLING_SOURCE] every signed edge source must be an exact revision in the target project'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  v_event_id := private.persist_verified_research_event(p_platform_event,v_expected_event_type,p_agent_actor_id);
  SELECT created_at INTO STRICT v_created_at FROM public.research_events WHERE event_id=v_event_id;

  INSERT INTO public.signature_nonces (actor_id,key_id,nonce,consumed_at)
  VALUES (v_publisher_actor_id,v_key_id,v_nonce,v_created_at)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> 1 THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_SIGNATURE_REPLAYED] signature nonce was previously consumed without this immutable receipt'
      USING ERRCODE = 'P0001';
  END IF;

  v_commit_rank := nextval('private.research_commit_rank_seq');
  IF v_revision = 1 THEN
    INSERT INTO private.research_nodes (node_id,node_kind,project_id,created_by,created_at)
    VALUES (v_node_id,v_kind::private.research_node_kind,v_project_id,p_agent_actor_id,v_created_at);
  END IF;
  v_label := CASE v_kind
    WHEN 'answer' THEN v_node->>'title'
    WHEN 'rebuttal' THEN v_node->>'title'
    WHEN 'evaluation' THEN (v_node->>'stance') || ': ' || (v_node#>>'{subjectRef,id}')
    WHEN 'dataset' THEN v_node->>'name'
    WHEN 'tool' THEN v_node->>'name'
  END;
  v_href := '/' || replace(v_kind,'_','-') || 's/' || v_node_id;
  INSERT INTO private.research_node_revisions (
    node_kind,node_id,revision,supersedes_revision,commit_rank,batch_rank,
    canonical_content_hash,label,state,canonical_href,source_event_id,created_by,created_at
  ) VALUES (
    v_kind::private.research_node_kind,v_node_id,v_revision,v_supersedes,v_commit_rank,v_batch_rank,
    v_canonical_payload_hash,v_label,(v_node->>'state')::private.research_document_state,
    v_href,v_event_id,p_agent_actor_id,v_created_at
  );

  IF v_kind='answer' THEN
    INSERT INTO private.answer_revisions (answer_id,revision,node_kind,title,synthesis,limitations)
    VALUES (v_node_id,v_revision,'answer',v_node->>'title',v_node->>'synthesis',
      ARRAY(SELECT value FROM jsonb_array_elements_text(v_node->'limitations') AS item(value)));
  ELSIF v_kind='rebuttal' THEN
    INSERT INTO private.rebuttal_revisions (rebuttal_id,revision,node_kind,title,argument,scope)
    VALUES (v_node_id,v_revision,'rebuttal',v_node->>'title',v_node->>'argument',
      ARRAY(SELECT value FROM jsonb_array_elements_text(v_node->'scope') AS item(value)));
  ELSIF v_kind='evaluation' THEN
    INSERT INTO private.evaluation_revisions (
      evaluation_id,revision,node_kind,subject_kind,subject_id,subject_revision,stance,rationale,method
    ) VALUES (
      v_node_id,v_revision,'evaluation',(v_node#>>'{subjectRef,kind}')::private.research_node_kind,
      v_node#>>'{subjectRef,id}',(v_node#>>'{subjectRef,revision}')::integer,
      (v_node->>'stance')::private.evaluation_stance,v_node->>'rationale',v_node->>'method'
    );
    FOR v_basis IN SELECT value FROM jsonb_array_elements(v_node->'basisRefs') AS basis(value) LOOP
      INSERT INTO private.evaluation_bases (evaluation_id,evaluation_revision,basis_kind,basis_id,basis_revision)
      VALUES (v_node_id,v_revision,(v_basis->>'kind')::private.research_node_kind,v_basis->>'id',(v_basis->>'revision')::integer);
    END LOOP;
  ELSIF v_kind='dataset' THEN
    INSERT INTO private.dataset_revisions (
      dataset_id,revision,node_kind,name,description,version,license,schema_uri,provenance,
      artifact_kind,artifact_id,artifact_revision
    ) VALUES (
      v_node_id,v_revision,'dataset',v_node->>'name',v_node->>'description',v_node->>'version',v_node->>'license',
      v_node->>'schemaUri',v_node->>'provenance','artifact',v_node#>>'{artifactRef,id}',(v_node#>>'{artifactRef,revision}')::integer
    );
  ELSE
    INSERT INTO private.tool_revisions (
      tool_id,revision,node_kind,name,description,tool_kind,version,runtime,input_schema_uri,output_schema_uri,
      license,provenance,artifact_kind,artifact_id,artifact_revision
    ) VALUES (
      v_node_id,v_revision,'tool',v_node->>'name',v_node->>'description',(v_node->>'toolKind')::private.tool_kind,
      v_node->>'version',v_node->>'runtime',v_node->>'inputSchemaUri',v_node->>'outputSchemaUri',
      v_node->>'license',v_node->>'provenance',
      CASE WHEN jsonb_typeof(v_node->'artifactRef')='object' THEN 'artifact'::private.research_node_kind ELSE NULL END,
      CASE WHEN jsonb_typeof(v_node->'artifactRef')='object' THEN v_node#>>'{artifactRef,id}' ELSE NULL END,
      CASE WHEN jsonb_typeof(v_node->'artifactRef')='object' THEN (v_node#>>'{artifactRef,revision}')::integer ELSE NULL END
    );
  END IF;

  FOR v_edge_index,v_edge IN
    SELECT ordinality::integer,value
    FROM jsonb_array_elements(v_expected_edges) WITH ORDINALITY AS edge(value,ordinality)
  LOOP
    v_source_ref := v_edge->'source';
    SELECT revision.commit_rank,revision.batch_rank,node.project_id
      INTO STRICT v_source
    FROM private.research_node_revisions AS revision
    JOIN private.research_nodes AS node
      ON node.node_kind=revision.node_kind AND node.node_id=revision.node_id
    WHERE revision.node_kind=(v_source_ref->>'kind')::private.research_node_kind
      AND revision.node_id=v_source_ref->>'id'
      AND revision.revision=(v_source_ref->>'revision')::integer;
    v_edge_id := 'typed_edge:' || v_event_id || ':' || v_edge_index::text;
    INSERT INTO private.research_edges (
      edge_id,edge_type,source_kind,source_id,source_revision,source_commit_rank,source_batch_rank,
      target_kind,target_id,target_revision,target_commit_rank,target_batch_rank,provenance_event_id,created_by,created_at
    ) VALUES (
      v_edge_id,(v_edge->>'type')::private.research_edge_type,
      (v_source_ref->>'kind')::private.research_node_kind,v_source_ref->>'id',(v_source_ref->>'revision')::integer,
      v_source.commit_rank,v_source.batch_rank,v_kind::private.research_node_kind,v_node_id,v_revision,
      v_commit_rank,v_batch_rank,v_event_id,p_agent_actor_id,v_created_at
    );
    v_edge_ids := v_edge_ids || jsonb_build_array(v_edge_id);
  END LOOP;

  INSERT INTO private.legacy_node_records (
    mapping_id,project_id,source_kind,source_id,source_revision,source_payload,source_checksum,status,
    mapped_node_kind,mapped_node_id,mapped_node_revision,source_event_id,created_at
  ) VALUES (
    'typed_node:'||v_event_id,v_project_id,v_kind::private.research_node_kind,v_node_id,v_revision,
    v_payload,v_canonical_payload_hash,'mapped',v_kind::private.research_node_kind,v_node_id,v_revision,v_event_id,v_created_at
  );

  v_receipt_id := gen_random_uuid();
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
    RAISE EXCEPTION '[TYPED_RESEARCH_SERVICE_ROLE_REQUIRED] service role is required'
      USING ERRCODE = '42501';
  END IF;
  RETURN private.execute_typed_research_submit(p_agent_actor_id,p_signature_envelope,p_platform_event);
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.assert_typed_research_text_array(jsonb,text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.assert_typed_research_ref(jsonb,text[],text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.derive_typed_research_incoming_edges(jsonb) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION private.execute_typed_research_submit(text,jsonb,jsonb) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.execute_typed_research_submit(text,jsonb,jsonb) FROM PUBLIC;--> statement-breakpoint
DO $typed_research_submit_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON TABLE private.research_submission_receipts FROM anon;
    REVOKE ALL ON FUNCTION private.assert_typed_research_text_array(jsonb,text) FROM anon;
    REVOKE ALL ON FUNCTION private.assert_typed_research_ref(jsonb,text[],text) FROM anon;
    REVOKE ALL ON FUNCTION private.derive_typed_research_incoming_edges(jsonb) FROM anon;
    REVOKE ALL ON FUNCTION private.execute_typed_research_submit(text,jsonb,jsonb) FROM anon;
    REVOKE ALL ON FUNCTION public.execute_typed_research_submit(text,jsonb,jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON TABLE private.research_submission_receipts FROM authenticated;
    REVOKE ALL ON FUNCTION private.assert_typed_research_text_array(jsonb,text) FROM authenticated;
    REVOKE ALL ON FUNCTION private.assert_typed_research_ref(jsonb,text[],text) FROM authenticated;
    REVOKE ALL ON FUNCTION private.derive_typed_research_incoming_edges(jsonb) FROM authenticated;
    REVOKE ALL ON FUNCTION private.execute_typed_research_submit(text,jsonb,jsonb) FROM authenticated;
    REVOKE ALL ON FUNCTION public.execute_typed_research_submit(text,jsonb,jsonb) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN
    REVOKE ALL ON TABLE private.research_submission_receipts FROM service_role;
    GRANT USAGE ON SCHEMA private TO service_role;
    GRANT EXECUTE ON FUNCTION private.execute_typed_research_submit(text,jsonb,jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.execute_typed_research_submit(text,jsonb,jsonb) TO service_role;
  END IF;
END
$typed_research_submit_grants$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.assert_typed_research_ref(
  p_ref jsonb,
  p_allowed_kinds text[],
  p_field text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_kind text;
  v_id text;
  v_revision integer;
BEGIN
  IF jsonb_typeof(p_ref) IS DISTINCT FROM 'object'
     OR NOT (p_ref ?& ARRAY['kind','id','revision'])
     OR (p_ref - ARRAY['kind','id','revision']::text[]) <> '{}'::jsonb
     OR jsonb_typeof(p_ref->'kind') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_ref->'id') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_ref->'revision') IS DISTINCT FROM 'number'
     OR p_ref->>'revision' !~ '^[1-9][0-9]{0,9}$' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] % must be an exact NodeRevisionRef', p_field
      USING ERRCODE = 'P0001';
  END IF;
  v_kind := p_ref->>'kind';
  v_id := p_ref->>'id';
  IF v_kind <> ALL(p_allowed_kinds)
     OR v_id = '' OR v_id IS DISTINCT FROM btrim(v_id)
     OR length(v_id) > 500 THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] % has an unsupported kind or non-canonical id', p_field
      USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    v_revision := (p_ref->>'revision')::integer;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] % revision is out of range', p_field
      USING ERRCODE = 'P0001';
  END;
  RETURN jsonb_build_object('kind',v_kind,'id',v_id,'revision',v_revision);
END
$$;
--> statement-breakpoint
-- Derive the only admissible incoming edge set from the normalized typed
-- document. The caller-supplied signed edge array must equal this ordered set
-- byte-for-semantic-byte as jsonb; an otherwise registry-valid extra edge is
-- rejected rather than accepted as caller policy.
CREATE OR REPLACE FUNCTION private.derive_typed_research_incoming_edges(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_kind text;
  v_schema text;
  v_node jsonb;
  v_node_id text;
  v_id_field text;
  v_revision integer;
  v_supersedes integer;
  v_target jsonb;
  v_edges jsonb := '[]'::jsonb;
  v_ref jsonb;
  v_item jsonb;
  v_index integer := 0;
  v_expected_node_keys text[];
  v_allowed_common text[] := ARRAY['answer','claim','question','dataset','tool','artifact','evidence','run','context_bundle'];
  v_allowed_basis text[] := ARRAY['claim','evidence','run','dataset','artifact'];
  v_count integer;
  v_unique_count integer;
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR NOT (p_payload ?& ARRAY['schema','entityType','graphVersion','producerActorId','draftedByActorId','publisherActorId','signerActorId','node','incomingEdges'])
     OR (p_payload - ARRAY['schema','entityType','graphVersion','producerActorId','draftedByActorId','publisherActorId','signerActorId','node','incomingEdges']::text[]) <> '{}'::jsonb
     OR jsonb_typeof(p_payload->'node') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_payload->'incomingEdges') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] canonical payload has an unexpected shape'
      USING ERRCODE = 'P0001';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    p_payload->'schema',p_payload->'entityType',p_payload->'graphVersion',p_payload->'producerActorId',
    p_payload->'draftedByActorId',p_payload->'publisherActorId',p_payload->'signerActorId'
  )) AS entry(value) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'string'
       OR v_item #>> '{}' = '' OR v_item #>> '{}' IS DISTINCT FROM btrim(v_item #>> '{}') THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] attribution and schema fields must be canonical strings'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  IF p_payload->>'graphVersion' IS DISTINCT FROM 'research-graph.v1'
     OR p_payload->>'signerActorId' IS DISTINCT FROM p_payload->>'publisherActorId' THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_GRAPH_VERSION_INVALID] graph version and signer attribution are fixed'
      USING ERRCODE = 'P0001';
  END IF;
  v_kind := p_payload->>'entityType';
  v_schema := p_payload->>'schema';
  v_node := p_payload->'node';
  v_id_field := CASE v_kind
    WHEN 'answer' THEN 'answerId'
    WHEN 'rebuttal' THEN 'rebuttalId'
    WHEN 'evaluation' THEN 'evaluationId'
    WHEN 'dataset' THEN 'datasetId'
    WHEN 'tool' THEN 'toolId'
    ELSE NULL
  END;
  IF v_id_field IS NULL OR v_schema IS DISTINCT FROM (CASE v_kind
    WHEN 'answer' THEN 'srp.answer.v1'
    WHEN 'rebuttal' THEN 'srp.rebuttal.v1'
    WHEN 'evaluation' THEN 'srp.evaluation.v1'
    WHEN 'dataset' THEN 'srp.dataset.v1'
    WHEN 'tool' THEN 'srp.tool.v1'
  END) THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_KIND_INVALID] only Answer, Rebuttal, Evaluation, Dataset, and Tool v1 payloads are accepted'
      USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(v_node->v_id_field) IS DISTINCT FROM 'string'
     OR v_node->>v_id_field = '' OR v_node->>v_id_field IS DISTINCT FROM btrim(v_node->>v_id_field)
     OR length(v_node->>v_id_field) > 500
     OR jsonb_typeof(v_node->'projectId') IS DISTINCT FROM 'string'
     OR v_node->>'projectId' = '' OR v_node->>'projectId' IS DISTINCT FROM btrim(v_node->>'projectId')
     OR jsonb_typeof(v_node->'revision') IS DISTINCT FROM 'number'
     OR v_node->>'revision' !~ '^[1-9][0-9]{0,9}$'
     OR jsonb_typeof(v_node->'state') IS DISTINCT FROM 'string'
     OR v_node->>'state' NOT IN ('draft','published','superseded','retracted') THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] typed node common fields are invalid'
      USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    v_revision := (v_node->>'revision')::integer;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] revision is out of range'
      USING ERRCODE = 'P0001';
  END;
  IF v_revision = 1 THEN
    IF jsonb_typeof(v_node->'supersedesRevision') IS DISTINCT FROM 'null' THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_REVISION_INVALID] revision 1 cannot supersede a previous revision'
        USING ERRCODE = 'P0001';
    END IF;
    v_supersedes := NULL;
  ELSE
    IF jsonb_typeof(v_node->'supersedesRevision') IS DISTINCT FROM 'number'
       OR v_node->>'supersedesRevision' !~ '^[1-9][0-9]{0,9}$'
       OR (v_node->>'supersedesRevision')::numeric <> v_revision - 1 THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_REVISION_INVALID] a new revision must supersede the immediately previous revision'
        USING ERRCODE = 'P0001';
    END IF;
    v_supersedes := v_revision - 1;
  END IF;
  v_node_id := v_node->>v_id_field;
  v_target := jsonb_build_object('kind',v_kind,'id',v_node_id,'revision',v_revision);
  IF v_supersedes IS NOT NULL THEN
    v_edges := v_edges || jsonb_build_array(jsonb_build_object(
      'type','supersedes',
      'source',jsonb_build_object('kind',v_kind,'id',v_node_id,'revision',v_supersedes),
      'target',v_target
    ));
  END IF;

  IF v_kind = 'answer' THEN
    v_expected_node_keys := ARRAY['answerId','projectId','revision','supersedesRevision','state','title','synthesis','limitations','questionRef','additionalInputs'];
    IF NOT (v_node ?& v_expected_node_keys) OR (v_node - v_expected_node_keys) <> '{}'::jsonb
       OR jsonb_typeof(v_node->'title') IS DISTINCT FROM 'string' OR btrim(v_node->>'title') = ''
       OR jsonb_typeof(v_node->'synthesis') IS DISTINCT FROM 'string' OR btrim(v_node->>'synthesis') = ''
       OR jsonb_typeof(v_node->'additionalInputs') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] Answer fields are invalid' USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.assert_typed_research_text_array(v_node->'limitations','limitations');
    v_ref := private.assert_typed_research_ref(v_node->'questionRef',ARRAY['question'],'questionRef');
    v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','answers','source',v_ref,'target',v_target));
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_node->'additionalInputs') AS item(value) LOOP
      v_ref := private.assert_typed_research_ref(v_item,v_allowed_common,'additionalInputs['||v_index::text||']');
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','derived_from','source',v_ref,'target',v_target));
      v_index := v_index + 1;
    END LOOP;
  ELSIF v_kind = 'rebuttal' THEN
    v_expected_node_keys := ARRAY['rebuttalId','projectId','revision','supersedesRevision','state','title','argument','scope','targetRef','basisRefs'];
    IF NOT (v_node ?& v_expected_node_keys) OR (v_node - v_expected_node_keys) <> '{}'::jsonb
       OR jsonb_typeof(v_node->'title') IS DISTINCT FROM 'string' OR btrim(v_node->>'title') = ''
       OR jsonb_typeof(v_node->'argument') IS DISTINCT FROM 'string' OR btrim(v_node->>'argument') = ''
       OR jsonb_typeof(v_node->'basisRefs') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] Rebuttal fields are invalid' USING ERRCODE = 'P0001';
    END IF;
    PERFORM private.assert_typed_research_text_array(v_node->'scope','scope');
    v_ref := private.assert_typed_research_ref(v_node->'targetRef',ARRAY['answer','claim'],'targetRef');
    v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','rebuts','source',v_ref,'target',v_target));
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_node->'basisRefs') AS item(value) LOOP
      v_ref := private.assert_typed_research_ref(v_item,v_allowed_basis,'basisRefs['||v_index::text||']');
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','grounds_rebuttal','source',v_ref,'target',v_target));
      v_index := v_index + 1;
    END LOOP;
  ELSIF v_kind = 'evaluation' THEN
    v_expected_node_keys := ARRAY['evaluationId','projectId','revision','supersedesRevision','state','subjectRef','basisRefs','stance','rationale','method'];
    IF NOT (v_node ?& v_expected_node_keys) OR (v_node - v_expected_node_keys) <> '{}'::jsonb
       OR jsonb_typeof(v_node->'basisRefs') IS DISTINCT FROM 'array' OR jsonb_array_length(v_node->'basisRefs') < 1
       OR jsonb_typeof(v_node->'stance') IS DISTINCT FROM 'string'
       OR v_node->>'stance' NOT IN ('supports','refutes','qualifies','reproduces','verifies')
       OR jsonb_typeof(v_node->'rationale') IS DISTINCT FROM 'string' OR btrim(v_node->>'rationale') = ''
       OR NOT (jsonb_typeof(v_node->'method') = 'null' OR (jsonb_typeof(v_node->'method') = 'string' AND btrim(v_node->>'method') <> '')) THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] Evaluation fields are invalid' USING ERRCODE = 'P0001';
    END IF;
    v_ref := private.assert_typed_research_ref(v_node->'subjectRef',ARRAY['claim'],'subjectRef');
    v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','evaluates','source',v_ref,'target',v_target));
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_node->'basisRefs') AS item(value) LOOP
      v_ref := private.assert_typed_research_ref(v_item,v_allowed_basis,'basisRefs['||v_index::text||']');
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','evaluation_basis','source',v_ref,'target',v_target));
      v_index := v_index + 1;
    END LOOP;
  ELSIF v_kind = 'dataset' THEN
    v_expected_node_keys := ARRAY['datasetId','projectId','revision','supersedesRevision','state','name','description','version','license','schemaUri','provenance','artifactRef'];
    IF NOT (v_node ?& v_expected_node_keys) OR (v_node - v_expected_node_keys) <> '{}'::jsonb
       OR jsonb_typeof(v_node->'name') IS DISTINCT FROM 'string' OR btrim(v_node->>'name') = ''
       OR jsonb_typeof(v_node->'description') IS DISTINCT FROM 'string' OR btrim(v_node->>'description') = ''
       OR jsonb_typeof(v_node->'version') IS DISTINCT FROM 'string' OR btrim(v_node->>'version') = ''
       OR jsonb_typeof(v_node->'license') IS DISTINCT FROM 'string' OR btrim(v_node->>'license') = ''
       OR jsonb_typeof(v_node->'provenance') IS DISTINCT FROM 'string' OR btrim(v_node->>'provenance') = ''
       OR NOT (jsonb_typeof(v_node->'schemaUri') = 'null' OR (jsonb_typeof(v_node->'schemaUri') = 'string' AND btrim(v_node->>'schemaUri') <> '')) THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] Dataset fields are invalid' USING ERRCODE = 'P0001';
    END IF;
    v_ref := private.assert_typed_research_ref(v_node->'artifactRef',ARRAY['artifact'],'artifactRef');
    v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','materializes_dataset','source',v_ref,'target',v_target));
  ELSE
    v_expected_node_keys := ARRAY['toolId','projectId','revision','supersedesRevision','state','name','description','toolKind','version','runtime','inputSchemaUri','outputSchemaUri','license','provenance','artifactRef'];
    IF NOT (v_node ?& v_expected_node_keys) OR (v_node - v_expected_node_keys) <> '{}'::jsonb
       OR jsonb_typeof(v_node->'name') IS DISTINCT FROM 'string' OR btrim(v_node->>'name') = ''
       OR jsonb_typeof(v_node->'description') IS DISTINCT FROM 'string' OR btrim(v_node->>'description') = ''
       OR jsonb_typeof(v_node->'toolKind') IS DISTINCT FROM 'string'
       OR v_node->>'toolKind' NOT IN ('skill','method','software','model','workflow')
       OR jsonb_typeof(v_node->'version') IS DISTINCT FROM 'string' OR btrim(v_node->>'version') = ''
       OR jsonb_typeof(v_node->'runtime') IS DISTINCT FROM 'string' OR btrim(v_node->>'runtime') = ''
       OR jsonb_typeof(v_node->'license') IS DISTINCT FROM 'string' OR btrim(v_node->>'license') = ''
       OR jsonb_typeof(v_node->'provenance') IS DISTINCT FROM 'string' OR btrim(v_node->>'provenance') = ''
       OR NOT (jsonb_typeof(v_node->'inputSchemaUri') = 'null' OR (jsonb_typeof(v_node->'inputSchemaUri') = 'string' AND btrim(v_node->>'inputSchemaUri') <> ''))
       OR NOT (jsonb_typeof(v_node->'outputSchemaUri') = 'null' OR (jsonb_typeof(v_node->'outputSchemaUri') = 'string' AND btrim(v_node->>'outputSchemaUri') <> ''))
       OR jsonb_typeof(v_node->'artifactRef') NOT IN ('null','object') THEN
      RAISE EXCEPTION '[TYPED_RESEARCH_PAYLOAD_INVALID] Tool fields are invalid' USING ERRCODE = 'P0001';
    END IF;
    IF jsonb_typeof(v_node->'artifactRef') = 'object' THEN
      v_ref := private.assert_typed_research_ref(v_node->'artifactRef',ARRAY['artifact'],'artifactRef');
      v_edges := v_edges || jsonb_build_array(jsonb_build_object('type','packages_tool','source',v_ref,'target',v_target));
    END IF;
  END IF;

  SELECT count(*)::integer, count(DISTINCT value)::integer
    INTO v_count, v_unique_count
  FROM jsonb_array_elements(v_edges) AS edge(value);
  IF v_count IS DISTINCT FROM v_unique_count THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_EDGE_SET_INVALID] derived incoming edges are not unique'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_payload->'incomingEdges' IS DISTINCT FROM v_edges THEN
    RAISE EXCEPTION '[TYPED_RESEARCH_EDGE_SET_MISMATCH] signed incoming edges must exactly equal the server-derived motif'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN v_edges;
END
$$;
