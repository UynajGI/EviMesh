import test from "node:test";
import assert from "node:assert/strict";
import { canonicalTypedResearchSubmission, prepareTypedResearchSubmission, TypedResearchPrepareError } from "../src/typed-research-prepare.mjs";

const projectId = "project-1";
const publisherActorId = "human-1";
const nonce = "0123456789abcdef";
const ref = (kind, id = `${kind}-1`, revision = 1) => ({ kind, id, revision });
const answerInput = () => ({ answerId: "answer-1", projectId, title: "Synthesis", synthesis: "The combined answer.", limitations: [], questionRef: ref("question"), additionalInputs: [] });

test("prepares an Answer with question and additional input edges in the signed payload", () => {
  const input = { answerId: "answer-1", projectId, title: "Synthesis", synthesis: "The combined answer.", limitations: [], questionRef: ref("question"), additionalInputs: [ref("dataset")], draftedByActorId: "agent-1" };
  const result = prepareTypedResearchSubmission({ kind: "answer", input, publisherActorId, nonce });
  assert.equal(result.eventType, "answer.created");
  assert.equal(result.payload.publisherActorId, publisherActorId);
  assert.equal(result.payload.draftedByActorId, "agent-1");
  assert.deepEqual(result.payload.incomingEdges.map((edge) => edge.type), ["answers", "derived_from"]);
  assert.match(result.signingBytesHash, /^sha256:[0-9a-f]{64}$/);
});

test("canonicalizes all five typed node command shapes through one boundary", () => {
  const inputs = {
    answer: { answerId: "answer-1", projectId, title: "a", synthesis: "s", limitations: [], questionRef: ref("question"), additionalInputs: [] },
    rebuttal: { rebuttalId: "rebuttal-1", projectId, title: "r", argument: "counter", scope: [], targetRef: ref("claim"), basisRefs: [ref("evidence")] },
    evaluation: { evaluationId: "evaluation-1", projectId, subjectRef: ref("claim"), basisRefs: [ref("run")], stance: "reproduces", rationale: "matched", method: null },
    dataset: { datasetId: "dataset-1", projectId, name: "d", description: "data", version: "1", license: "CC-BY-4.0", schemaUri: null, provenance: "source", artifactRef: ref("artifact") },
    tool: { toolId: "tool-1", projectId, name: "t", description: "tool", toolKind: "skill", version: "1", runtime: "node@22", inputSchemaUri: null, outputSchemaUri: null, license: "MIT", provenance: "source", artifactRef: null },
  };
  for (const [kind, input] of Object.entries(inputs)) {
    const result = canonicalTypedResearchSubmission({ kind, input, publisherActorId });
    assert.equal(result.payload.entityType, kind);
    assert.equal(result.command.projectId, projectId);
  }
});

test("rejects invalid endpoint motifs before signing", () => {
  assert.throws(() => canonicalTypedResearchSubmission({ kind: "answer", publisherActorId, input: { answerId: "answer-1", projectId, title: "a", synthesis: "s", questionRef: ref("claim"), limitations: [], additionalInputs: [] } }), (error) => error instanceof TypedResearchPrepareError && /answers/.test(error.message));
  assert.throws(() => canonicalTypedResearchSubmission({ kind: "evaluation", publisherActorId, input: { evaluationId: "evaluation-1", projectId, subjectRef: ref("claim"), basisRefs: [], stance: "supports", rationale: "r" } }), /at least one/);
});

test("revision 2 binds contiguous supersession and uses the revised event type", () => {
  const result = prepareTypedResearchSubmission({
    kind: "answer",
    publisherActorId,
    nonce,
    input: { ...answerInput(), revision: 2, supersedesRevision: 1 },
  });
  assert.equal(result.eventType, "answer.revised");
  assert.equal(result.payload.node.revision, 2);
  assert.equal(result.payload.node.supersedesRevision, 1);
  assert.deepEqual(result.payload.incomingEdges[0], {
    type: "supersedes",
    source: { kind: "answer", id: "answer-1", revision: 1 },
    target: { kind: "answer", id: "answer-1", revision: 2 },
  });
  assert.throws(() => canonicalTypedResearchSubmission({ kind: "answer", publisherActorId, input: { ...answerInput(), revision: 3, supersedesRevision: 1 } }), /previous revision/);
});
