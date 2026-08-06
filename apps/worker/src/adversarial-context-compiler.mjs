import { FrontierContextCompileError, compileFrontierContext } from "./frontier-context-compiler.mjs";

const ADVERSARIAL_RELATION_TYPES = new Set(["refutes", "qualifies", "contradicts", "challenges"]);

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new FrontierContextCompileError(`${field} must be a non-empty string`);
  return value.trim();
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new FrontierContextCompileError(`${field} must be a positive integer`);
  return value;
}

function memberKey(member) {
  return `${member.claimId}@${member.revision}`;
}

function relationPayload(relation, memberKeys) {
  if (!relation || typeof relation !== "object") throw new FrontierContextCompileError("adversarial relation is required");
  if (!ADVERSARIAL_RELATION_TYPES.has(relation.relationType)) {
    throw new FrontierContextCompileError("adversarial relation must be refutes, qualifies, contradicts, or challenges");
  }
  const source = { claimId: requiredText(relation.sourceClaimId, "adversarial relation source claim id"), revision: positiveInteger(relation.sourceRevision, "adversarial relation source revision") };
  const target = { claimId: requiredText(relation.targetClaimId, "adversarial relation target claim id"), revision: positiveInteger(relation.targetRevision, "adversarial relation target revision") };
  if (!memberKeys.has(memberKey(source)) || !memberKeys.has(memberKey(target))) {
    throw new FrontierContextCompileError("adversarial relation endpoint is outside the fixed frontier", "ADVERSARIAL_RELATION_NOT_PINNED");
  }
  return { relationType: relation.relationType, source, target };
}

/**
 * Compile a bounded anti-consensus ContextBundle.
 *
 * `mainstreamClaimKeys` is an explicit, auditable classification supplied by
 * the policy/repository layer. Mainstream Claim statements are withheld while
 * fixed metadata and counter-relations remain available for independent work.
 */
export function compileAdversarialContext({ mainstreamClaimKeys, adversarialRelations = [], ...frontierContext } = {}) {
  if (!Array.isArray(mainstreamClaimKeys)) throw new FrontierContextCompileError("mainstream claim keys must be an array");
  if (!Array.isArray(adversarialRelations)) throw new FrontierContextCompileError("adversarial relations must be an array");
  const bundle = compileFrontierContext(frontierContext);
  const fixedKeys = new Set(bundle.frontier.members.map(memberKey));
  const mainstream = new Set(mainstreamClaimKeys.map((key, index) => requiredText(key, `mainstream claim key ${index}`)));
  for (const key of mainstream) {
    if (!fixedKeys.has(key)) throw new FrontierContextCompileError("mainstream claim is outside the fixed frontier", "MAINSTREAM_CLAIM_NOT_PINNED");
  }
  const members = bundle.frontier.members.map((member) => {
    if (!mainstream.has(memberKey(member))) return member;
    const { statement, ...claimWithoutMainstreamSummary } = member.claim;
    return { ...member, claim: claimWithoutMainstreamSummary };
  });
  const counterRelations = adversarialRelations.map((relation) => relationPayload(relation, fixedKeys))
    .sort((left, right) => `${left.relationType}:${memberKey(left.source)}>${memberKey(left.target)}`.localeCompare(`${right.relationType}:${memberKey(right.source)}>${memberKey(right.target)}`));
  return { ...bundle, mode: "adversarial", frontier: { ...bundle.frontier, members }, counterRelations };
}

/** Worker entry point; all classifications and relationships are revision-pinned. */
export async function compileAdversarialContextJob({ repository, taskId, taskRevision, frontierSnapshotId } = {}) {
  const methods = ["getTaskRevision", "getFrontierSnapshot", "listFrontierMembers", "getClaimRevision", "listFrontierDependencies", "listMainstreamClaimKeys", "listAdversarialRelations"];
  if (!repository || methods.some((method) => typeof repository[method] !== "function")) {
    throw new FrontierContextCompileError("repository adversarial context methods are required");
  }
  taskId = requiredText(taskId, "task id");
  taskRevision = positiveInteger(taskRevision, "task revision");
  frontierSnapshotId = requiredText(frontierSnapshotId, "frontier snapshot id");
  const [task, frontier, members] = await Promise.all([
    repository.getTaskRevision(taskId, taskRevision),
    repository.getFrontierSnapshot(frontierSnapshotId),
    repository.listFrontierMembers(frontierSnapshotId),
  ]);
  const hydratedMembers = await Promise.all((members ?? []).map(async (member) => ({ ...member, claimRevisionData: await repository.getClaimRevision(member.claimId, member.claimRevision) })));
  const fixedMembers = hydratedMembers.map(({ claimId, claimRevision }) => ({ claimId, revision: claimRevision }));
  const [dependencies, mainstreamClaimKeys, adversarialRelations] = await Promise.all([
    repository.listFrontierDependencies({ frontierSnapshotId, members: fixedMembers }),
    repository.listMainstreamClaimKeys({ frontierSnapshotId, members: fixedMembers }),
    repository.listAdversarialRelations({ frontierSnapshotId, members: fixedMembers }),
  ]);
  return compileAdversarialContext({ taskRevision: task, frontierSnapshot: frontier, frontierMembers: hydratedMembers, dependencies, mainstreamClaimKeys, adversarialRelations });
}
