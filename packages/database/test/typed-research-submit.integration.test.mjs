import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import postgres from 'postgres';
import { canonicalJson } from '../../protocol/src/hash.mjs';
import { createTypedResearchCanonicalPayload } from '../../protocol/src/typed-research-canonical.mjs';
import { createTypedResearchSubmitRepository } from '../src/typed-research-submit.mjs';

const databaseUrl = process.env.EVIMESH_TEST_DATABASE_URL;

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function uuidv7() {
  const hex = randomBytes(16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function signingKeyBytes(seed) {
  // Unique per run: fingerprints are globally unique and the fixture commits.
  return Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    createHash('sha256').update(String(seed)).digest(),
  ]);
}

function edge(type, source, target) {
  return { type, source, target };
}

function makeSubmission({ kind, node, incomingEdges, agentActorId, publisherActorId, keyId, nonce, eventId = uuidv7() }) {
  const payload = createTypedResearchCanonicalPayload({
    schema: `srp.${kind}.v1`,
    entityType: kind,
    producerActorId: agentActorId,
    draftedByActorId: agentActorId,
    publisherActorId,
    signerActorId: publisherActorId,
    node,
    incomingEdges,
  });
  const eventType = `${kind}.${node.revision === 1 ? 'created' : 'revised'}`;
  const nonceValue = nonce ?? randomBytes(18).toString('base64url');
  const signatureEnvelope = {
    schema: 'srp.client-signature-envelope.v1',
    event_type: eventType,
    payload,
    nonce: nonceValue,
    signing_bytes_hash: sha256(canonicalJson({ event_type: eventType, payload, nonce: nonceValue })),
    signature: { algorithm: 'Ed25519', key_id: keyId, value: randomBytes(64).toString('base64url') },
  };
  const idField = `${kind}Id`;
  const eventPayload = {
    entity_type: kind,
    entity_id: node[idField],
    project_id: node.projectId,
    revision: node.revision,
    supersedes_revision: node.supersedesRevision,
    actor_id: agentActorId,
    producer_actor_id: agentActorId,
    drafted_by_actor_id: agentActorId,
    publisher_actor_id: publisherActorId,
    signer_actor_id: publisherActorId,
    signing_key_id: keyId,
    nonce: nonceValue,
    publisher_signature_envelope: signatureEnvelope,
    graph_version: 'research-graph.v1',
    canonical_content_hash: sha256(canonicalJson(payload)),
    typed_document: payload.node,
    incoming_edges: payload.incomingEdges,
  };
  const platformEvent = {
    eventId,
    eventType,
    payload: eventPayload,
    hash: sha256(canonicalJson({ event_type: eventType, payload: eventPayload, parents: [] })),
    signature: { algorithm: 'Ed25519', key_id: 'platform-test-key', value: randomBytes(64).toString('base64url') },
    parents: [],
    createdAt: new Date().toISOString(),
  };
  return { agentActorId, signatureEnvelope, platformEvent };
}

test('typed submit RPC atomically covers five kinds, rev2, exact retry, failures, and ACL in PostgreSQL', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 5 });
  const repository = createTypedResearchSubmitRepository(sql);
  try {
    const suffix = randomUUID();
    const projectId = `project_018f0f4a-5c00-7000-8000-${suffix.replaceAll('-', '').slice(0, 12)}`;
    const humanId = `typed-human-${suffix}`;
    const otherHumanId = `typed-other-human-${suffix}`;
    const agentId = `typed-agent-${suffix}`;
    const siblingAgentId = `typed-sibling-agent-${suffix}`;
    const viewerAgentId = `typed-viewer-agent-${suffix}`;
    const keyId = `typed-key-${suffix}`;
    const otherKeyId = `typed-other-key-${suffix}`;
    const now = new Date();
    const mainKey = signingKeyBytes(`main:${suffix}`);
    const otherKey = signingKeyBytes(`other:${suffix}`);
    const refs = {
      question: { kind: 'question', id: `typed-question-${suffix}`, revision: 1 },
      claim: { kind: 'claim', id: `typed-claim-${suffix}`, revision: 1 },
      evidence: { kind: 'evidence', id: `typed-evidence-${suffix}`, revision: 1 },
      artifact: { kind: 'artifact', id: `typed-artifact-${suffix}`, revision: 1 },
    };
    const sourceEventId = uuidv7();

    await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO public.actors (
          actor_id,actor_type,identity_strength,owner_actor_id,created_at,updated_at
        ) VALUES
          (${humanId},'human','verified',NULL,${now},${now}),
          (${otherHumanId},'human','verified',NULL,${now},${now}),
          (${agentId},'agent','self_declared',${humanId},${now},${now}),
          (${siblingAgentId},'agent','self_declared',${humanId},${now},${now}),
          (${viewerAgentId},'agent','self_declared',${humanId},${now},${now})
      `;
      await transaction`
        INSERT INTO public.signing_keys (
          key_id,actor_id,algorithm,public_key,fingerprint,label,created_at,updated_at
        ) VALUES
          (${keyId},${humanId},'Ed25519',${mainKey.toString('base64url')},${sha256(mainKey)},'Typed test key',${now},${now}),
          (${otherKeyId},${otherHumanId},'Ed25519',${otherKey.toString('base64url')},${sha256(otherKey)},'Other typed test key',${now},${now})
      `;
      await transaction`
        INSERT INTO public.projects (project_id,state,name,summary,created_by,license,created_at,updated_at)
        VALUES (${projectId},'active','Typed submit integration','Atomic typed mutation fixture',${humanId},'CC0-1.0',${now},${now})
      `;
      await transaction`
        INSERT INTO public.project_members (
          project_id,actor_id,role,status,joined_at,created_at,updated_at
        ) VALUES
          (${projectId},${agentId},'contributor','active',${now},${now},${now}),
          (${projectId},${siblingAgentId},'contributor','active',${now},${now},${now}),
          (${projectId},${viewerAgentId},'viewer','active',${now},${now},${now})
      `;
      await transaction`
        INSERT INTO public.research_events (event_id,event_type,payload,hash,signature,parents,created_at)
        VALUES (
          ${sourceEventId},'fixture.seeded',${JSON.stringify({ actor_id: agentId })}::jsonb,
          ${sha256(`source:${suffix}`)},${JSON.stringify({ algorithm: 'Ed25519', key_id: 'platform-test-key', value: 'fixture' })}::jsonb,
          '[]'::jsonb,${now}
        )
      `;
      for (const ref of Object.values(refs)) {
        await transaction`
          INSERT INTO private.research_nodes (node_id,node_kind,project_id,created_by,created_at)
          VALUES (${ref.id},${ref.kind}::private.research_node_kind,${projectId},${agentId},${now})
        `;
        await transaction`
          INSERT INTO private.research_node_revisions (
            node_kind,node_id,revision,supersedes_revision,canonical_content_hash,label,state,
            canonical_href,source_event_id,created_by,created_at
          ) VALUES (
            ${ref.kind}::private.research_node_kind,${ref.id},1,NULL,${sha256(`${ref.kind}:${ref.id}`)},${ref.id},'published',
            ${`/${ref.kind}s/${ref.id}`},${sourceEventId},${agentId},${now}
          )
        `;
      }
    });

    const answerId = `typed-answer-${suffix}`;
    const answerTarget = { kind: 'answer', id: answerId, revision: 1 };
    const answerNode = {
      answerId, projectId, revision: 1, supersedesRevision: null, state: 'published',
      title: 'A reproducible answer', synthesis: 'The fixture supports this answer.', limitations: ['fixture only'],
      questionRef: refs.question, additionalInputs: [refs.evidence],
    };
    const answer = makeSubmission({
      kind: 'answer', node: answerNode,
      incomingEdges: [edge('answers', refs.question, answerTarget), edge('derived_from', refs.evidence, answerTarget)],
      agentActorId: agentId, publisherActorId: humanId, keyId,
    });
    const answerResult = await repository.executeTypedResearchSubmit(answer);
    assert.equal(answerResult.node.kind, 'answer');
    assert.equal(answerResult.edgeIds.length, 2);
    assert.deepEqual(await repository.executeTypedResearchSubmit(answer), answerResult);

    const replayPayload = structuredClone(answer.signatureEnvelope.payload);
    replayPayload.node.answerId = `typed-answer-replay-${suffix}`;
    replayPayload.incomingEdges = replayPayload.incomingEdges.map((entry) => ({
      ...entry,
      target: { ...entry.target, id: replayPayload.node.answerId },
    }));
    const replayConflict = makeSubmission({
      kind: 'answer', node: replayPayload.node, incomingEdges: replayPayload.incomingEdges,
      agentActorId: agentId, publisherActorId: humanId, keyId,
      nonce: answer.signatureEnvelope.nonce,
    });
    await assert.rejects(
      repository.executeTypedResearchSubmit(replayConflict),
      (error) => error.code === 'TYPED_RESEARCH_REPLAY_CONFLICT' && error.status === 409,
    );

    // A nonce belongs to the Human signing key, not merely to one Agent
    // receipt. A sibling Agent owned by the same Human can reach the event
    // insert, but the shared Human/key/nonce constraint must roll the entire
    // transaction (including that event) back.
    const siblingReplayId = `typed-sibling-replay-${suffix}`;
    const siblingReplay = makeSubmission({
      kind: 'answer',
      node: { ...answerNode, answerId: siblingReplayId },
      incomingEdges: [
        edge('answers', refs.question, { kind: 'answer', id: siblingReplayId, revision: 1 }),
        edge('derived_from', refs.evidence, { kind: 'answer', id: siblingReplayId, revision: 1 }),
      ],
      agentActorId: siblingAgentId,
      publisherActorId: humanId,
      keyId,
      nonce: answer.signatureEnvelope.nonce,
    });
    await assert.rejects(
      repository.executeTypedResearchSubmit(siblingReplay),
      (error) => error.code === 'TYPED_RESEARCH_SIGNATURE_REPLAYED' && error.status === 409,
    );
    const [siblingReplayRollback] = await sql`
      SELECT
        (SELECT count(*)::int FROM public.research_events WHERE event_id=${siblingReplay.platformEvent.eventId}) AS events,
        (SELECT count(*)::int FROM private.research_nodes WHERE node_id=${siblingReplayId}) AS nodes,
        (SELECT count(*)::int FROM private.research_submission_receipts WHERE node_id=${siblingReplayId}) AS receipts
    `;
    assert.deepEqual(siblingReplayRollback, { events: 0, nodes: 0, receipts: 0 });

    const answerRevision2Target = { kind: 'answer', id: answerId, revision: 2 };
    const answerRevision2Node = { ...answerNode, revision: 2, supersedesRevision: 1, synthesis: 'The independent revision retains the conclusion.' };
    const answerRevision2 = makeSubmission({
      kind: 'answer', node: answerRevision2Node,
      incomingEdges: [
        edge('supersedes', answerTarget, answerRevision2Target),
        edge('answers', refs.question, answerRevision2Target),
        edge('derived_from', refs.evidence, answerRevision2Target),
      ],
      agentActorId: agentId, publisherActorId: humanId, keyId,
    });
    const revision2Result = await repository.executeTypedResearchSubmit(answerRevision2);
    assert.equal(revision2Result.node.revision, 2);
    assert.equal(revision2Result.edgeIds.length, 3);

    const raceAnswerId = `typed-answer-race-${suffix}`;
    const raceRevision1Target = { kind: 'answer', id: raceAnswerId, revision: 1 };
    const raceRevision1Node = { ...answerNode, answerId: raceAnswerId };
    await repository.executeTypedResearchSubmit(makeSubmission({
      kind: 'answer',
      node: raceRevision1Node,
      incomingEdges: [
        edge('answers', refs.question, raceRevision1Target),
        edge('derived_from', refs.evidence, raceRevision1Target),
      ],
      agentActorId: agentId,
      publisherActorId: humanId,
      keyId,
    }));
    const raceRevision2Target = { kind: 'answer', id: raceAnswerId, revision: 2 };
    const raceRevision2Base = {
      ...raceRevision1Node,
      revision: 2,
      supersedesRevision: 1,
    };
    const raceCandidates = [
      makeSubmission({
        kind: 'answer',
        node: { ...raceRevision2Base, synthesis: 'Concurrent revision candidate A.' },
        incomingEdges: [
          edge('supersedes', raceRevision1Target, raceRevision2Target),
          edge('answers', refs.question, raceRevision2Target),
          edge('derived_from', refs.evidence, raceRevision2Target),
        ],
        agentActorId: agentId,
        publisherActorId: humanId,
        keyId,
      }),
      makeSubmission({
        kind: 'answer',
        node: { ...raceRevision2Base, synthesis: 'Concurrent revision candidate B.' },
        incomingEdges: [
          edge('supersedes', raceRevision1Target, raceRevision2Target),
          edge('answers', refs.question, raceRevision2Target),
          edge('derived_from', refs.evidence, raceRevision2Target),
        ],
        agentActorId: agentId,
        publisherActorId: humanId,
        keyId,
      }),
    ];
    const raceOutcomes = await Promise.allSettled(
      raceCandidates.map((candidate) => repository.executeTypedResearchSubmit(candidate)),
    );
    assert.equal(raceOutcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    const [raceRejection] = raceOutcomes.filter((outcome) => outcome.status === 'rejected');
    assert.ok(
      ['TYPED_RESEARCH_TARGET_REVISION_EXISTS', 'TYPED_RESEARCH_REVISION_RACE'].includes(raceRejection.reason.code),
      `unexpected revision race error: ${raceRejection.reason.code}`,
    );
    const [raceStored] = await sql`
      SELECT
        (SELECT count(*)::int FROM private.research_node_revisions
          WHERE node_kind='answer' AND node_id=${raceAnswerId} AND revision=2) AS revisions,
        (SELECT count(*)::int FROM private.research_submission_receipts
          WHERE node_kind='answer' AND node_id=${raceAnswerId} AND revision=2) AS receipts,
        (SELECT count(*)::int FROM public.research_events
          WHERE event_id IN ${sql(raceCandidates.map((candidate) => candidate.platformEvent.eventId))}) AS events
    `;
    assert.deepEqual(raceStored, { revisions: 1, receipts: 1, events: 1 });

    const rebuttalId = `typed-rebuttal-${suffix}`;
    const rebuttalTarget = { kind: 'rebuttal', id: rebuttalId, revision: 1 };
    const rebuttalNode = {
      rebuttalId, projectId, revision: 1, supersedesRevision: null, state: 'published',
      title: 'A bounded rebuttal', argument: 'The evidence does not cover the external population.', scope: ['external validity'],
      targetRef: answerRevision2Target, basisRefs: [refs.evidence],
    };
    const rebuttalResult = await repository.executeTypedResearchSubmit(makeSubmission({
      kind: 'rebuttal', node: rebuttalNode,
      incomingEdges: [edge('rebuts', answerRevision2Target, rebuttalTarget), edge('grounds_rebuttal', refs.evidence, rebuttalTarget)],
      agentActorId: agentId, publisherActorId: humanId, keyId,
    }));
    assert.equal(rebuttalResult.node.kind, 'rebuttal');

    const evaluationId = `typed-evaluation-${suffix}`;
    const evaluationTarget = { kind: 'evaluation', id: evaluationId, revision: 1 };
    const evaluationNode = {
      evaluationId, projectId, revision: 1, supersedesRevision: null, state: 'published',
      subjectRef: refs.claim, basisRefs: [refs.evidence], stance: 'qualifies',
      rationale: 'The evidence supports only the measured population.', method: 'independent review',
    };
    const evaluationResult = await repository.executeTypedResearchSubmit(makeSubmission({
      kind: 'evaluation', node: evaluationNode,
      incomingEdges: [edge('evaluates', refs.claim, evaluationTarget), edge('evaluation_basis', refs.evidence, evaluationTarget)],
      agentActorId: agentId, publisherActorId: humanId, keyId,
    }));
    assert.equal(evaluationResult.node.kind, 'evaluation');

    const datasetId = `typed-dataset-${suffix}`;
    const datasetTarget = { kind: 'dataset', id: datasetId, revision: 1 };
    const datasetNode = {
      datasetId, projectId, revision: 1, supersedesRevision: null, state: 'published',
      name: 'Open fixture dataset', description: 'A versioned integration fixture.', version: '1.0.0',
      license: 'CC0-1.0', schemaUri: null, provenance: 'Generated only for database integration.', artifactRef: refs.artifact,
    };
    const datasetResult = await repository.executeTypedResearchSubmit(makeSubmission({
      kind: 'dataset', node: datasetNode,
      incomingEdges: [edge('materializes_dataset', refs.artifact, datasetTarget)],
      agentActorId: agentId, publisherActorId: humanId, keyId,
    }));
    assert.equal(datasetResult.node.kind, 'dataset');

    const toolId = `typed-tool-${suffix}`;
    const toolTarget = { kind: 'tool', id: toolId, revision: 1 };
    const toolNode = {
      toolId, projectId, revision: 1, supersedesRevision: null, state: 'published',
      name: 'Fixture method', description: 'A pinned test method.', toolKind: 'method', version: '1.0.0',
      runtime: 'oci:test@sha256:fixture', inputSchemaUri: null, outputSchemaUri: null,
      license: 'Apache-2.0', provenance: 'Integration fixture.', artifactRef: refs.artifact,
    };
    const toolResult = await repository.executeTypedResearchSubmit(makeSubmission({
      kind: 'tool', node: toolNode,
      incomingEdges: [edge('packages_tool', refs.artifact, toolTarget)],
      agentActorId: agentId, publisherActorId: humanId, keyId,
    }));
    assert.equal(toolResult.node.kind, 'tool');

    const tampered = structuredClone(makeSubmission({
      kind: 'tool', node: { ...toolNode, toolId: `typed-tampered-${suffix}` },
      incomingEdges: [edge('packages_tool', refs.artifact, { kind: 'tool', id: `typed-tampered-${suffix}`, revision: 1 })],
      agentActorId: agentId, publisherActorId: humanId, keyId,
    }));
    tampered.signatureEnvelope.payload.incomingEdges[0].type = 'derived_from';
    tampered.signatureEnvelope.signing_bytes_hash = sha256(canonicalJson({
      event_type: tampered.signatureEnvelope.event_type,
      payload: tampered.signatureEnvelope.payload,
      nonce: tampered.signatureEnvelope.nonce,
    }));
    tampered.platformEvent.payload.publisher_signature_envelope = tampered.signatureEnvelope;
    tampered.platformEvent.payload.incoming_edges = tampered.signatureEnvelope.payload.incomingEdges;
    tampered.platformEvent.hash = sha256(canonicalJson({
      event_type: tampered.platformEvent.eventType,
      payload: tampered.platformEvent.payload,
      parents: tampered.platformEvent.parents,
    }));
    await assert.rejects(
      repository.executeTypedResearchSubmit(tampered),
      (error) => error.code === 'TYPED_RESEARCH_EDGE_SET_MISMATCH',
    );

    const viewerAnswerId = `typed-viewer-answer-${suffix}`;
    await assert.rejects(
      repository.executeTypedResearchSubmit(makeSubmission({
        kind: 'answer',
        node: { ...answerNode, answerId: viewerAnswerId },
        incomingEdges: [
          edge('answers', refs.question, { kind: 'answer', id: viewerAnswerId, revision: 1 }),
          edge('derived_from', refs.evidence, { kind: 'answer', id: viewerAnswerId, revision: 1 }),
        ],
        agentActorId: viewerAgentId, publisherActorId: humanId, keyId,
      })),
      (error) => error.code === 'TYPED_RESEARCH_PROJECT_ROLE_FORBIDDEN' && error.status === 403,
    );

    const ownerMismatchId = `typed-owner-mismatch-${suffix}`;
    await assert.rejects(
      repository.executeTypedResearchSubmit(makeSubmission({
        kind: 'answer',
        node: { ...answerNode, answerId: ownerMismatchId },
        incomingEdges: [
          edge('answers', refs.question, { kind: 'answer', id: ownerMismatchId, revision: 1 }),
          edge('derived_from', refs.evidence, { kind: 'answer', id: ownerMismatchId, revision: 1 }),
        ],
        agentActorId: agentId, publisherActorId: otherHumanId, keyId: otherKeyId,
      })),
      (error) => error.code === 'TYPED_RESEARCH_PUBLISHER_OWNERSHIP_MISMATCH' && error.status === 403,
    );

    const failureId = `typed-injected-failure-${suffix}`;
    const failureNonce = randomBytes(18).toString('base64url');
    const injectedFailure = makeSubmission({
      kind: 'tool', node: { ...toolNode, toolId: failureId },
      incomingEdges: [edge('packages_tool', refs.artifact, { kind: 'tool', id: failureId, revision: 1 })],
      agentActorId: agentId, publisherActorId: humanId, keyId, nonce: failureNonce,
      eventId: answerResult.eventId,
    });
    const [beforeFailure] = await sql`
      SELECT
        (SELECT count(*)::int FROM private.research_nodes WHERE node_id=${failureId}) AS nodes,
        (SELECT count(*)::int FROM private.research_node_revisions WHERE node_id=${failureId}) AS revisions,
        (SELECT count(*)::int FROM private.tool_revisions WHERE tool_id=${failureId}) AS typed,
        (SELECT count(*)::int FROM private.research_edges WHERE target_id=${failureId}) AS edges,
        (SELECT count(*)::int FROM private.legacy_node_records WHERE source_id=${failureId}) AS crosswalks,
        (SELECT count(*)::int FROM public.signature_nonces WHERE actor_id=${humanId} AND key_id=${keyId} AND nonce=${failureNonce}) AS nonces,
        (SELECT count(*)::int FROM private.research_submission_receipts WHERE node_id=${failureId}) AS receipts
    `;
    await assert.rejects(repository.executeTypedResearchSubmit(injectedFailure));
    const [afterFailure] = await sql`
      SELECT
        (SELECT count(*)::int FROM private.research_nodes WHERE node_id=${failureId}) AS nodes,
        (SELECT count(*)::int FROM private.research_node_revisions WHERE node_id=${failureId}) AS revisions,
        (SELECT count(*)::int FROM private.tool_revisions WHERE tool_id=${failureId}) AS typed,
        (SELECT count(*)::int FROM private.research_edges WHERE target_id=${failureId}) AS edges,
        (SELECT count(*)::int FROM private.legacy_node_records WHERE source_id=${failureId}) AS crosswalks,
        (SELECT count(*)::int FROM public.signature_nonces WHERE actor_id=${humanId} AND key_id=${keyId} AND nonce=${failureNonce}) AS nonces,
        (SELECT count(*)::int FROM private.research_submission_receipts WHERE node_id=${failureId}) AS receipts
    `;
    assert.deepEqual(afterFailure, beforeFailure);

    await sql`
      UPDATE public.signing_keys
      SET revoked_at=${new Date()},revocation_reason='integration revocation',updated_at=${new Date()}
      WHERE key_id=${keyId}
    `;
    const revokedId = `typed-revoked-key-${suffix}`;
    await assert.rejects(
      repository.executeTypedResearchSubmit(makeSubmission({
        kind: 'answer', node: { ...answerNode, answerId: revokedId },
        incomingEdges: [
          edge('answers', refs.question, { kind: 'answer', id: revokedId, revision: 1 }),
          edge('derived_from', refs.evidence, { kind: 'answer', id: revokedId, revision: 1 }),
        ],
        agentActorId: agentId, publisherActorId: humanId, keyId,
      })),
      (error) => error.code === 'TYPED_RESEARCH_SIGNING_KEY_INVALID' && error.status === 403,
    );

    const [stored] = await sql`
      SELECT
        (SELECT count(*)::int FROM private.research_submission_receipts WHERE project_id=${projectId}) AS receipts,
        (SELECT count(*)::int FROM private.research_node_revisions r JOIN private.research_nodes n USING (node_id,node_kind)
          WHERE n.project_id=${projectId} AND r.node_kind IN ('answer','rebuttal','evaluation','dataset','tool')) AS revisions,
        (SELECT count(*)::int FROM private.evaluation_bases WHERE evaluation_id=${evaluationId}) AS bases
    `;
    assert.deepEqual(stored, { receipts: 8, revisions: 8, bases: 1 });

    const [attribution] = await sql`
      SELECT
        (SELECT bool_and(node.created_by=${agentId})
          FROM private.research_nodes AS node
          WHERE node.project_id=${projectId}
            AND node.node_kind IN ('answer','rebuttal','evaluation','dataset','tool')) AS "nodesByAgent",
        (SELECT bool_and(revision.created_by=${agentId})
          FROM private.research_node_revisions AS revision
          JOIN private.research_nodes AS node USING (node_kind,node_id)
          WHERE node.project_id=${projectId}
            AND revision.node_kind IN ('answer','rebuttal','evaluation','dataset','tool')) AS "revisionsByAgent",
        (SELECT bool_and(edge.created_by=${agentId})
          FROM private.research_edges AS edge
          JOIN private.research_nodes AS node
            ON node.node_kind=edge.target_kind AND node.node_id=edge.target_id
          WHERE node.project_id=${projectId}
            AND edge.target_kind IN ('answer','rebuttal','evaluation','dataset','tool')) AS "edgesByAgent",
        (SELECT bool_and(receipt.agent_actor_id=${agentId}
            AND event.payload->>'actor_id'=${agentId}
            AND event.payload->>'publisher_actor_id'=${humanId}
            AND event.payload->>'signer_actor_id'=${humanId})
          FROM private.research_submission_receipts AS receipt
          JOIN public.research_events AS event USING (event_id)
          WHERE receipt.project_id=${projectId}) AS "eventsByAgentHumanSigned"
    `;
    assert.deepEqual(attribution, {
      nodesByAgent: true,
      revisionsByAgent: true,
      edgesByAgent: true,
      eventsByAgentHumanSigned: true,
    });

    const [privileges] = await sql`
      SELECT
        has_table_privilege('anon','private.research_submission_receipts','SELECT') AS "anonRead",
        has_table_privilege('authenticated','private.research_submission_receipts','SELECT') AS "authenticatedRead",
        has_table_privilege('service_role','private.research_submission_receipts','SELECT') AS "serviceRead",
        has_function_privilege('anon','private.execute_typed_research_submit(text,jsonb,jsonb)','EXECUTE') AS "anonPrivateRpc",
        has_function_privilege('authenticated','private.execute_typed_research_submit(text,jsonb,jsonb)','EXECUTE') AS "authenticatedPrivateRpc",
        has_function_privilege('service_role','private.execute_typed_research_submit(text,jsonb,jsonb)','EXECUTE') AS "servicePrivateRpc",
        has_function_privilege('anon','public.execute_typed_research_submit(text,jsonb,jsonb)','EXECUTE') AS "anonRpc",
        has_function_privilege('authenticated','public.execute_typed_research_submit(text,jsonb,jsonb)','EXECUTE') AS "authenticatedRpc",
        has_function_privilege('service_role','public.execute_typed_research_submit(text,jsonb,jsonb)','EXECUTE') AS "serviceRpc"
    `;
    assert.deepEqual(privileges, {
      anonRead: false,
      authenticatedRead: false,
      serviceRead: false,
      anonPrivateRpc: false,
      authenticatedPrivateRpc: false,
      servicePrivateRpc: true,
      anonRpc: false,
      authenticatedRpc: false,
      serviceRpc: true,
    });
  } finally {
    await sql.end();
  }
});
