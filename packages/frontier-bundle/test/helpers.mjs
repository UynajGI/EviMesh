import { buildMerkleTree } from "../../merkle/src/merkle-tree.mjs";
import { hashResearchEventLeaf } from "../../merkle/src/research-event-leaf.mjs";

export function makeEvent(eventId, objectId, createdAt) {
  return {
    schema: "srp.event.v1",
    event_id: eventId,
    event_type: "claim.created",
    payload: { claim_id: objectId },
    hash: `sha256:${eventId.length.toString(16).padStart(2, "0")}${"0".repeat(62)}`,
    signature: { algorithm: "Ed25519", value: "sig" },
    parents: [],
    createdAt,
  };
}

export function makeCheckpoint(events) {
  const leafHashes = events.map((event) => hashResearchEventLeaf(event));
  const tree = buildMerkleTree(leafHashes);
  return {
    checkpointId: `checkpoint_${events[0].event_id}`,
    schema: "evimesh.merkle-checkpoint.v1",
    firstEventId: events[0].event_id,
    lastEventId: events[events.length - 1].event_id,
    eventCount: events.length,
    rootHash: tree.root,
  };
}

/** In-memory repository with one published frontier of two claims. */
export function createSourceRepository() {
  const events = [makeEvent("event-1", "claim_1", "2026-08-01T00:00:00.000Z"), makeEvent("event-2", "claim_2", "2026-08-02T00:00:00.000Z")];
  const checkpoint = makeCheckpoint(events);
  const snapshot = { snapshotId: "frontier_1", projectId: "project_1", sequence: 3, createdAt: "2026-08-03T00:00:00.000Z" };
  const members = [
    { claimId: "claim_1", claimRevision: 2, membershipType: "core", status: "accepted" },
    { claimId: "claim_2", claimRevision: 1, membershipType: "core", status: "contested" },
  ];
  const claimRevisions = {
    "claim_1@2": { claimId: "claim_1", revision: 2, state: "accepted", statement: "s1", questionId: "question_1", createdBy: "actor_1" },
    "claim_2@1": { claimId: "claim_2", revision: 1, state: "contested", statement: "s2", questionId: "question_1", createdBy: "actor_2" },
  };
  const evidence = {
    evidence_1: { evidenceId: "evidence_1", evidenceType: "dataset", artifactId: "artifact_1", artifactRevision: 1 },
  };
  const artifactRevisions = {
    "artifact_1@1": { artifactId: "artifact_1", revision: 1, rawHash: `sha256:${"a".repeat(64)}`, sizeBytes: 128, mediaType: "text/csv" },
  };
  const receipts = [
    { receiptId: "receipt_1", claimId: "claim_1", claimRevision: 2, runId: "run_1", outcome: "supports", actorId: "actor_3" },
    { receiptId: "receipt_2", claimId: "claim_1", claimRevision: 1, runId: "run_2", outcome: "supports", actorId: "actor_3" },
  ];
  const findings = { receipt_1: [{ findingId: "finding_1", receiptId: "receipt_1", severity: "note", code: "match" }] };
  const edges = [
    { statementId: "statement_1", objectType: "claim", objectId: "claim_1", edgeType: "produced" },
    { statementId: "statement_2", objectType: "evidence", objectId: "evidence_1", edgeType: "produced" },
    { statementId: "statement_3", objectType: "verification", objectId: "receipt_1", edgeType: "produced" },
  ];
  const statements = {
    statement_1: { statementId: "statement_1", actorId: "actor_1", role: "originator" },
    statement_2: { statementId: "statement_2", actorId: "actor_2", role: "contributor" },
    statement_3: { statementId: "statement_3", actorId: "actor_3", role: "verifier" },
  };

  return {
    _snapshot: snapshot,
    getFrontierSnapshot: async (snapshotId) => (snapshotId === snapshot.snapshotId ? snapshot : null),
    listFrontierMembers: async (snapshotId) => (snapshotId === snapshot.snapshotId ? members : []),
    getClaimRevision: async (claimId, revision) => claimRevisions[`${claimId}@${revision}`] ?? null,
    listEvidenceForClaimRevision: async (claimId, revision) => (claimId === "claim_1" && revision === 2 ? [{ evidenceId: "evidence_1" }] : []),
    getEvidence: async (evidenceId) => evidence[evidenceId] ?? null,
    getArtifactRevision: async (artifactId, revision) => artifactRevisions[`${artifactId}@${revision}`] ?? null,
    listVerificationReceipts: async ({ claimId }) => receipts.filter((receipt) => receipt.claimId === claimId),
    getVerificationReceipt: async (receiptId) => receipts.find((receipt) => receipt.receiptId === receiptId) ?? null,
    listVerificationFindings: async (receiptId) => findings[receiptId] ?? [],
    listContributionEdgesForObject: async (objectType, objectId) => edges.filter((edge) => edge.objectType === objectType && edge.objectId === objectId),
    listContributionStatementsByIds: async (ids) => ids.map((id) => statements[id]).filter(Boolean),
    listResearchEvents: async ({ objectId }) => events.filter((event) => event.payload.claim_id === objectId),
    getMerkleCheckpointForEvent: async () => checkpoint,
    listResearchEventRange: async ({ firstEventId, lastEventId }) => {
      const start = events.findIndex((event) => event.event_id === firstEventId);
      const end = events.findIndex((event) => event.event_id === lastEventId);
      if (start < 0 || end < 0) return [];
      return events.slice(start, end + 1);
    },
    getOtsProof: async () => null,
  };
}

/** Empty target repository for import/DR tests. */
export function createTargetRepository() {
  const state = {
    snapshots: new Map(),
    members: [],
    claims: new Map(),
    claimRevisions: new Map(),
    evidence: new Map(),
    evidenceLinks: [],
    receipts: new Map(),
    findings: [],
    statements: new Map(),
    edges: [],
    events: [],
    checkpoints: new Map(),
  };
  return {
    state,
    getFrontierSnapshot: async (id) => state.snapshots.get(id) ?? null,
    getClaimRevision: async (claimId, revision) => state.claimRevisions.get(`${claimId}@${revision}`) ?? null,
    getEvidence: async (id) => state.evidence.get(id) ?? null,
    getVerificationReceipt: async (id) => state.receipts.get(id) ?? null,
    withTransaction: async (callback) => callback({
      insertClaim: async (claim) => { state.claims.set(claim.claimId, claim); return claim; },
      insertClaimRevision: async (revision) => { state.claimRevisions.set(`${revision.claimId}@${revision.revision}`, revision); return revision; },
      insertEvidence: async (evidence) => { state.evidence.set(evidence.evidenceId, evidence); return evidence; },
      insertEvidenceClaimLink: async (link) => { state.evidenceLinks.push(link); return link; },
      insertVerificationReceipt: async (receipt) => { state.receipts.set(receipt.receiptId, receipt); return receipt; },
      insertVerificationFinding: async (finding) => { state.findings.push(finding); return finding; },
      insertContributionStatement: async (statement) => { state.statements.set(statement.statementId, statement); return statement; },
      insertContributionEdge: async (edge) => { state.edges.push(edge); return edge; },
      appendResearchEvent: async (event) => { state.events.push(event); return event; },
      insertMerkleCheckpoint: async (checkpoint) => { state.checkpoints.set(checkpoint.checkpointId, checkpoint); return checkpoint; },
      insertFrontierSnapshot: async (snapshot) => { state.snapshots.set(snapshot.snapshotId, snapshot); return snapshot; },
      insertFrontierMember: async (member) => { state.members.push(member); return member; },
    }),
  };
}
