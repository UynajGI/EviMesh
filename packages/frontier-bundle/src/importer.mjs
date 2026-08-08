import { verifyFrontierBundle } from "./verify.mjs";
import { BUNDLE_FILES, BUNDLE_DIRECTORIES } from "./spec.mjs";

export class BundleImportError extends Error {
  constructor(message, code = "BUNDLE_IMPORT_INVALID", conflicts = []) {
    super(message);
    this.name = "BundleImportError";
    this.code = code;
    this.conflicts = conflicts;
  }
}

function parseJson(files, path) {
  return JSON.parse(typeof files[path] === "string" ? files[path] : new TextDecoder().decode(files[path]));
}

function collectBundleDocuments(files) {
  const claims = [];
  const evidence = [];
  const receipts = [];
  const events = [];
  const checkpoints = [];
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith(`${BUNDLE_DIRECTORIES.claims}/`)) claims.push({ path, document: parseJson(files, path) });
    else if (path.startsWith(`${BUNDLE_DIRECTORIES.evidence}/`)) evidence.push({ path, document: parseJson(files, path) });
    else if (path.startsWith(`${BUNDLE_DIRECTORIES.verificationReceipts}/`)) receipts.push({ path, document: parseJson(files, path) });
    else if (path.startsWith(`${BUNDLE_DIRECTORIES.checkpoints}/`)) checkpoints.push({ path, document: parseJson(files, path) });
  }
  if (BUNDLE_FILES.events in files && String(files[BUNDLE_FILES.events]).trim().length > 0) {
    for (const line of String(files[BUNDLE_FILES.events]).trim().split("\n")) {
      if (line.trim().length > 0) events.push(JSON.parse(line));
    }
  }
  const prerequisites = BUNDLE_FILES.prerequisites in files ? parseJson(files, BUNDLE_FILES.prerequisites) : {};
  return { claims, evidence, receipts, events, checkpoints, prerequisites, frontier: parseJson(files, BUNDLE_FILES.frontier) };
}

/**
 * Import precheck (M12-13): verify the bundle offline and report conflicts
 * against the target repository WITHOUT writing anything.
 */
export async function precheckBundleImport({ repository, files, platformKey = null } = {}) {
  if (!repository) throw new BundleImportError("repository is required");
  const verification = await verifyFrontierBundle(files, { platformKey });
  if (!verification.valid) throw new BundleImportError(`bundle failed offline verification: ${verification.findings.join("; ")}`);

  const { claims, evidence, receipts, frontier } = collectBundleDocuments(files);
  const conflicts = [];

  if (typeof repository.getFrontierSnapshot === "function") {
    const existingSnapshot = await repository.getFrontierSnapshot(frontier.snapshot.snapshotId);
    if (existingSnapshot) conflicts.push({ path: BUNDLE_FILES.frontier, objectId: frontier.snapshot.snapshotId, reason: "frontier snapshot already exists" });
  }
  if (typeof repository.getClaimRevision === "function") {
    for (const { path, document } of claims) {
      const existing = await repository.getClaimRevision(document.member.claimId, document.member.claimRevision);
      if (existing) conflicts.push({ path, objectId: document.member.claimId, reason: "claim revision already exists" });
    }
  }
  if (typeof repository.getEvidence === "function") {
    for (const { path, document } of evidence) {
      const existing = await repository.getEvidence(document.evidence.evidenceId);
      if (existing) conflicts.push({ path, objectId: document.evidence.evidenceId, reason: "evidence already exists" });
    }
  }
  if (typeof repository.getVerificationReceipt === "function") {
    for (const { path, document } of receipts) {
      const existing = await repository.getVerificationReceipt(document.receipt.receiptId);
      if (existing) conflicts.push({ path, objectId: document.receipt.receiptId, reason: "verification receipt already exists" });
    }
  }

  return Object.freeze({ ok: conflicts.length === 0, conflicts, claimCount: claims.length, evidenceCount: evidence.length, receiptCount: receipts.length });
}

/**
 * Import a verified bundle into an empty (or compatible) instance (M12-14).
 * Runs the precheck first; refuses to write when conflicts exist.
 */
export async function importFrontierBundle({ repository, files, platformKey = null } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") throw new BundleImportError("repository withTransaction is required");
  const precheck = await precheckBundleImport({ repository, files, platformKey });
  if (!precheck.ok) throw new BundleImportError("import conflicts detected; nothing was written", "BUNDLE_IMPORT_CONFLICT", precheck.conflicts);

  const { claims, evidence, receipts, events, checkpoints, prerequisites, frontier } = collectBundleDocuments(files);
  const contributions = parseJson(files, BUNDLE_FILES.contributions);

  return repository.withTransaction(async (transaction) => {
    const importers = {
      claim: ["insertClaim", "insertClaimRevision"],
      evidence: ["insertEvidence"],
      receipt: ["insertVerificationReceipt"],
      contribution: ["insertContributionStatement", "insertContributionEdge"],
      event: ["appendResearchEvent"],
      checkpoint: ["insertMerkleCheckpoint"],
      frontier: ["insertFrontierSnapshot", "insertFrontierMember"],
    };
    const needed = [
      ...importers.claim, ...importers.evidence, ...importers.receipt,
      ...importers.contribution, ...importers.event, ...importers.checkpoint, ...importers.frontier,
    ];
    for (const method of needed) {
      if (typeof transaction[method] !== "function") throw new BundleImportError(`transaction ${method} is required`);
    }

    // Prerequisites first (topological order) so foreign keys resolve on an
    // empty instance. Each inserter is optional: reference rows are restored
    // only when the repository supports them.
    if (prerequisites && typeof prerequisites === "object") {
      const optionalInsert = async (method, row) => {
        if (!row || typeof transaction[method] !== "function") return;
        await transaction[method](row);
      };
      for (const actor of prerequisites.actors ?? []) await optionalInsert("insertActor", actor);
      await optionalInsert("insertProject", prerequisites.project);
      await optionalInsert("insertProjectRevision", prerequisites.projectRevision);
      for (const artifact of prerequisites.artifacts ?? []) await optionalInsert("insertArtifact", artifact);
      for (const artifactRevision of prerequisites.artifactRevisions ?? []) await optionalInsert("insertArtifactRevision", artifactRevision);
      for (const contract of prerequisites.verificationContracts ?? []) await optionalInsert("insertVerificationContract", contract);
      for (const contractRevision of prerequisites.verificationContractRevisions ?? []) await optionalInsert("insertVerificationContractRevision", contractRevision);
      for (const run of prerequisites.runs ?? []) await optionalInsert("insertRun", run);
    }

    for (const { document } of claims) {
      await transaction.insertClaim({ claimId: document.member.claimId, questionId: document.claimRevision.questionId ?? null, state: document.claimRevision.state, createdBy: document.claimRevision.createdBy });
      await transaction.insertClaimRevision(document.claimRevision);
    }
    for (const { document } of evidence) {
      await transaction.insertEvidence(document.evidence);
      for (const link of document.links ?? []) {
        await transaction.insertEvidenceClaimLink?.({
          evidenceId: document.evidence.evidenceId,
          claimId: link.claimId,
          claimRevision: link.claimRevision,
          relationType: link.relationType ?? "supports",
          createdBy: link.createdBy ?? document.evidence.createdBy,
        });
      }
    }
    for (const { document } of receipts) {
      await transaction.insertVerificationReceipt(document.receipt);
      for (const finding of document.findings ?? []) await transaction.insertVerificationFinding(finding);
    }
    for (const statement of contributions.statements ?? []) await transaction.insertContributionStatement(statement);
    for (const edge of contributions.edges ?? []) await transaction.insertContributionEdge(edge);
    for (const event of events) await transaction.appendResearchEvent(event);
    for (const { document } of checkpoints) await transaction.insertMerkleCheckpoint(document.checkpoint);
    await transaction.insertFrontierSnapshot(frontier.snapshot);
    for (const member of frontier.members) await transaction.insertFrontierMember({ ...member, snapshotId: frontier.snapshot.snapshotId });

    return Object.freeze({
      imported: true,
      claims: claims.length,
      evidence: evidence.length,
      receipts: receipts.length,
      events: events.length,
      checkpoints: checkpoints.length,
      frontierSnapshotId: frontier.snapshot.snapshotId,
    });
  });
}
