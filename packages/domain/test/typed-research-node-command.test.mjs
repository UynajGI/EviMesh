import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAnswer,
  createDataset,
  createEvaluation,
  createRebuttal,
  createTool,
} from '../src/typed-research-node-command.mjs';

const ref = (kind, id, revision = 1) => ({ kind, id, revision });

function repositoryFixture(sourceRefs, { commitRank = 20, stableNodes = [] } = {}) {
  const calls = [];
  const sources = new Map(sourceRefs.map((source, index) => [
    `${source.kind}:${source.id}@${source.revision}`,
    { ...source, commitRank: index + 1, batchRank: 1 },
  ]));
  const nodes = new Map(stableNodes.map((node) => [`${node.nodeKind}:${node.nodeId}`, node]));
  const repository = {
    calls,
    withTransaction: (callback) => callback(repository),
    allocateResearchCommitRank: async () => commitRank,
    getResearchNode: async ({ kind, id }) => nodes.get(`${kind}:${id}`) ?? null,
    getResearchNodeRevision: async (source) => sources.get(`${source.kind}:${source.id}@${source.revision}`) ?? null,
    appendResearchEvent: async (value) => { calls.push(['event', value]); return value; },
    insertResearchNode: async (value) => { calls.push(['node', value]); return value; },
    insertResearchNodeRevision: async (value) => { calls.push(['revision', value]); return value; },
    insertResearchEdge: async (value) => { calls.push(['edge', value]); return value; },
    insertAnswerRevision: async (value) => { calls.push(['answer', value]); return value; },
    insertRebuttalRevision: async (value) => { calls.push(['rebuttal', value]); return value; },
    insertEvaluationRevision: async (value) => { calls.push(['evaluation', value]); return value; },
    insertEvaluationBasis: async (value) => { calls.push(['basis', value]); return value; },
    insertDatasetRevision: async (value) => { calls.push(['dataset', value]); return value; },
    insertToolRevision: async (value) => { calls.push(['tool', value]); return value; },
  };
  return repository;
}

const signedEvent = ({ eventType, payload }) => ({ eventId: `event-${eventType}`, eventType, payload, hash: `sha256:${'a'.repeat(64)}`, signature: { algorithm: 'ed25519', key_id: 'key-1', value: 'sig' } });
const common = { actorId: 'actor-1', actorRole: 'contributor', projectId: 'project-1', eventFactory: signedEvent };

test('creates an Answer revision and its complete immutable incoming edge set atomically', async () => {
  const question = ref('question', 'question-1');
  const evidence = ref('evidence', 'evidence-1');
  const repository = repositoryFixture([question, evidence]);
  const result = await createAnswer({
    repository, ...common, answerId: 'answer-1', title: 'Synthesis', synthesis: 'A complete answer.',
    limitations: ['One boundary'], questionRef: question, additionalInputs: [evidence],
  });
  assert.deepEqual(result.edges.map((edge) => edge.edgeType), ['answers', 'derived_from']);
  assert.equal(result.revision.canonicalContentHash.startsWith('sha256:'), true);
  assert.equal(result.edges.every((edge) => edge.targetCommitRank === 20 && edge.provenanceEventId === result.revision.sourceEventId), true);
  assert.deepEqual(repository.calls.map(([kind]) => kind), ['event', 'node', 'revision', 'answer', 'edge', 'edge']);
  assert.equal(repository.calls[0][1].payload.incoming_edges.length, 2);
});

test('appends revision 2 with a supersedes edge and never reinserts the stable node', async () => {
  const previous = ref('answer', 'answer-1', 1);
  const question = ref('question', 'question-1');
  const stableNode = { nodeId: 'answer-1', nodeKind: 'answer', projectId: 'project-1', createdBy: 'actor-original' };
  const repository = repositoryFixture([previous, question], { commitRank: 30, stableNodes: [stableNode] });
  const result = await createAnswer({
    repository, ...common, answerId: 'answer-1', revision: 2, supersedesRevision: 1,
    title: 'Revised synthesis', synthesis: 'The relationship set changed.', questionRef: question,
  });
  assert.equal(result.node, stableNode);
  assert.equal(result.revision.revision, 2);
  assert.equal(result.revision.supersedesRevision, 1);
  assert.equal(result.typedRevision.revision, 2);
  assert.equal(result.event.eventType, 'answer.revised');
  assert.deepEqual(result.edges.map((edge) => edge.edgeType), ['supersedes', 'answers']);
  assert.deepEqual(result.event.payload.incoming_edges.map((edge) => edge.type), ['supersedes', 'answers']);
  assert.equal(result.event.payload.supersedes_revision, 1);
  assert.equal(repository.calls.some(([kind]) => kind === 'node'), false);
});

test('rejects skipped revisions, missing predecessors, and a mismatched stable identity', async () => {
  const question = ref('question', 'question-1');
  const stableNode = { nodeId: 'answer-1', nodeKind: 'answer', projectId: 'project-1' };
  await assert.rejects(
    createAnswer({ repository: repositoryFixture([question], { stableNodes: [stableNode] }), ...common, answerId: 'answer-1', revision: 3, supersedesRevision: 1, title: 'A', synthesis: 'B', questionRef: question }),
    (error) => error.code === 'RESEARCH_REVISION_LINEAGE_INVALID',
  );
  await assert.rejects(
    createAnswer({ repository: repositoryFixture([question], { stableNodes: [stableNode] }), ...common, answerId: 'answer-1', revision: 3, supersedesRevision: 2, title: 'A', synthesis: 'B', questionRef: question }),
    (error) => error.code === 'RESEARCH_PREVIOUS_REVISION_NOT_FOUND',
  );
  await assert.rejects(
    createAnswer({ repository: repositoryFixture([ref('answer', 'answer-1'), question], { stableNodes: [{ ...stableNode, projectId: 'other-project' }] }), ...common, answerId: 'answer-1', revision: 2, supersedesRevision: 1, title: 'A', synthesis: 'B', questionRef: question }),
    (error) => error.code === 'RESEARCH_NODE_IDENTITY_MISMATCH',
  );
  await assert.rejects(
    createAnswer({ repository: repositoryFixture([ref('answer', 'answer-1'), ref('answer', 'answer-1', 2), question], { stableNodes: [stableNode] }), ...common, answerId: 'answer-1', revision: 2, supersedesRevision: 1, title: 'A', synthesis: 'B', questionRef: question }),
    (error) => error.code === 'RESEARCH_TARGET_REVISION_EXISTS',
  );
});

test('rejects a signature payload produced after any revision edge is tampered', async () => {
  const previous = ref('answer', 'answer-1', 1);
  const question = ref('question', 'question-1');
  const repository = repositoryFixture([previous, question], {
    stableNodes: [{ nodeId: 'answer-1', nodeKind: 'answer', projectId: 'project-1' }],
  });
  await assert.rejects(
    createAnswer({
      repository, ...common, answerId: 'answer-1', revision: 2, supersedesRevision: 1,
      title: 'A', synthesis: 'B', questionRef: question,
      eventFactory: ({ eventType, payload }) => ({
        eventId: 'event-tampered', eventType,
        payload: { ...payload, incoming_edges: payload.incoming_edges.slice(1) },
      }),
    }),
    (error) => error.code === 'RESEARCH_EVENT_PAYLOAD_MISMATCH',
  );
});

test('creates Evaluation subject and basis motifs without collapsing stance into Evidence', async () => {
  const subject = ref('claim', 'claim-1', 2);
  const evidence = ref('evidence', 'evidence-1');
  const run = ref('run', 'run-1');
  const repository = repositoryFixture([subject, evidence, run]);
  const result = await createEvaluation({
    repository, ...common, evaluationId: 'evaluation-1', subjectRef: subject, basisRefs: [evidence, run],
    stance: 'qualifies', rationale: 'The interval is narrower.', method: 'Independent analysis',
  });
  assert.deepEqual(result.edges.map((edge) => edge.edgeType), ['evaluates', 'evaluation_basis', 'evaluation_basis']);
  assert.equal(result.bases.length, 2);
  assert.equal(result.typedRevision.subjectRevision, 2);
  assert.equal(result.typedRevision.stance, 'qualifies');
});

test('creates Rebuttal, Dataset, and Tool with their explicit graph motifs', async () => {
  const claim = ref('claim', 'claim-1');
  const artifact = ref('artifact', 'artifact-1');
  const rebuttalRepo = repositoryFixture([claim]);
  const rebuttal = await createRebuttal({ repository: rebuttalRepo, ...common, rebuttalId: 'rebuttal-1', title: 'Counterargument', argument: 'The premise fails.', targetRef: claim });
  assert.deepEqual(rebuttal.edges.map((edge) => edge.edgeType), ['rebuts']);

  const dataset = await createDataset({ repository: repositoryFixture([artifact]), ...common, datasetId: 'dataset-1', name: 'Dataset', description: 'Versioned data.', version: '1', license: 'CC-BY-4.0', provenance: 'Signed collection.', artifactRef: artifact });
  assert.deepEqual(dataset.edges.map((edge) => edge.edgeType), ['materializes_dataset']);

  const tool = await createTool({ repository: repositoryFixture([artifact]), ...common, toolId: 'tool-1', name: 'Tool', description: 'Deterministic workflow.', toolKind: 'skill', version: '1', runtime: 'oci:tool@sha256:abc', license: 'Apache-2.0', provenance: 'Signed package.', artifactRef: artifact });
  assert.deepEqual(tool.edges.map((edge) => edge.edgeType), ['packages_tool']);
});

test('fails closed for missing sources, non-forward ranks, invalid stance, and payload substitution', async () => {
  const claim = ref('claim', 'claim-1');
  await assert.rejects(
    createEvaluation({ repository: repositoryFixture([]), ...common, evaluationId: 'evaluation-1', subjectRef: claim, basisRefs: [claim], stance: 'supports', rationale: 'Reason' }),
    (error) => error.code === 'RESEARCH_NODE_REVISION_NOT_FOUND' && error.status === 404,
  );
  await assert.rejects(
    createEvaluation({ repository: repositoryFixture([claim], { commitRank: 1 }), ...common, evaluationId: 'evaluation-1', subjectRef: claim, basisRefs: [claim], stance: 'supports', rationale: 'Reason' }),
    (error) => error.code === 'RESEARCH_EDGE_INVALID' && error.status === 409,
  );
  await assert.rejects(
    createEvaluation({ repository: repositoryFixture([claim]), ...common, evaluationId: 'evaluation-1', subjectRef: claim, basisRefs: [claim], stance: 'score', rationale: 'Reason' }),
    /unsupported evaluation stance/,
  );
  await assert.rejects(
    createAnswer({ repository: repositoryFixture([ref('question', 'q1')]), ...common, eventFactory: ({ eventType }) => ({ eventId: 'event-bad', eventType, payload: { substituted: true } }), answerId: 'answer-1', title: 'A', synthesis: 'B', questionRef: ref('question', 'q1') }),
    (error) => error.code === 'RESEARCH_EVENT_PAYLOAD_MISMATCH',
  );
  await assert.rejects(
    createAnswer({ repository: repositoryFixture([ref('question', 'q1'), ref('answer', 'answer-1')]), ...common, answerId: 'answer-1', title: 'A', synthesis: 'B', questionRef: ref('question', 'q1') }),
    (error) => error.code === 'RESEARCH_TARGET_REVISION_EXISTS' && error.status === 409,
  );
  await assert.rejects(
    createAnswer({ repository: repositoryFixture([ref('question', 'q1'), ref('project', 'p1')]), ...common, answerId: 'answer-1', title: 'A', synthesis: 'B', questionRef: ref('question', 'q1'), additionalInputs: [ref('project', 'p1')] }),
    (error) => error.code === 'RESEARCH_EDGE_INVALID' && /does not allow/.test(error.message),
  );
});

test('preserves agent drafting attribution inside the human publisher event', async () => {
  const question = ref('question', 'q1');
  const envelope = { schema: 'srp.client-signature-envelope.v1', nonce: 'abcdefghijklmnop', signature: { key_id: 'human-key', value: 'sig' } };
  const result = await createAnswer({
    repository: repositoryFixture([question]), ...common, answerId: 'answer-1', title: 'A', synthesis: 'B', questionRef: question,
    draftedByActorId: 'agent-1', publisherSignatureEnvelope: envelope,
  });
  assert.equal(result.event.payload.drafted_by_actor_id, 'agent-1');
  assert.equal(result.event.payload.signer_actor_id, 'actor-1');
  assert.deepEqual(result.event.payload.publisher_signature_envelope, envelope);
  await assert.rejects(
    createAnswer({ repository: repositoryFixture([question]), ...common, answerId: 'answer-2', title: 'A', synthesis: 'B', questionRef: question, draftedByActorId: 'agent-1' }),
    (error) => error.code === 'RESEARCH_DRAFTER_SIGNATURE_REQUIRED',
  );
});
