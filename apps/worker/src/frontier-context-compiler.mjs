/**
 * Compile a bounded, revision-pinned research context for a Task.
 *
 * The compiler deliberately accepts immutable inputs instead of current
 * projections. That keeps a ContextBundle reproducible when a Claim or Task
 * is revised after the bundle is produced.
 */
export class FrontierContextCompileError extends Error {
  constructor(message, code = "FRONTIER_CONTEXT_INVALID") {
    super(message);
    this.name = "FrontierContextCompileError";
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FrontierContextCompileError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new FrontierContextCompileError(`${field} must be a positive integer`);
  }
  return value;
}

function canonicalJson(value, field) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new FrontierContextCompileError(`${field} must be JSON-serializable`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => canonicalJson(item, `${field}[${index}]`));
  if (typeof value !== "object") throw new FrontierContextCompileError(`${field} must be JSON-serializable`);
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalJson(value[key], `${field}.${key}`);
  return result;
}

function taskPayload(taskRevision) {
  if (!taskRevision || typeof taskRevision !== "object") throw new FrontierContextCompileError("task revision is required");
  return {
    taskId: requiredText(taskRevision.taskId, "task revision taskId"),
    revision: positiveInteger(taskRevision.revision, "task revision revision"),
    title: requiredText(taskRevision.title, "task revision title"),
    description: requiredText(taskRevision.description, "task revision description"),
    inputs: canonicalJson(taskRevision.inputs, "task revision inputs"),
    outputs: canonicalJson(taskRevision.outputs, "task revision outputs"),
    acceptance: canonicalJson(taskRevision.acceptance, "task revision acceptance"),
  };
}

function snapshotPayload(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new FrontierContextCompileError("frontier snapshot is required");
  return {
    snapshotId: requiredText(snapshot.snapshotId, "frontier snapshot id"),
    projectId: requiredText(snapshot.projectId, "frontier project id"),
    sequence: positiveInteger(snapshot.sequence, "frontier sequence"),
    projectRevision: positiveInteger(snapshot.projectRevision, "frontier project revision"),
    checkpoint: canonicalJson(snapshot.checkpoint, "frontier checkpoint"),
  };
}

function memberPayload(member, snapshotId) {
  if (!member || typeof member !== "object") throw new FrontierContextCompileError("frontier member is required");
  if (member.snapshotId !== undefined && requiredText(member.snapshotId, "frontier member snapshot id") !== snapshotId) {
    throw new FrontierContextCompileError("frontier member belongs to another snapshot", "FRONTIER_MEMBER_SNAPSHOT_MISMATCH");
  }
  const claimId = requiredText(member.claimId, "frontier member claim id");
  const revision = positiveInteger(member.claimRevision, "frontier member claim revision");
  const claim = member.claimRevisionData;
  if (!claim || typeof claim !== "object") throw new FrontierContextCompileError("frontier member claim revision data is required");
  if (requiredText(claim.claimId, "claim revision claim id") !== claimId || positiveInteger(claim.revision, "claim revision revision") !== revision) {
    throw new FrontierContextCompileError("frontier member claim revision is not pinned", "FRONTIER_MEMBER_REVISION_MISMATCH");
  }
  return {
    claimId,
    revision,
    membershipType: requiredText(member.membershipType, "frontier member membership type"),
    claim: {
      state: requiredText(claim.state, "claim revision state"),
      statement: requiredText(claim.statement, "claim revision statement"),
      scope: canonicalJson(claim.scope, "claim revision scope"),
      assumptions: canonicalJson(claim.assumptions, "claim revision assumptions"),
      falsification: canonicalJson(claim.falsification, "claim revision falsification"),
    },
  };
}

function memberKey(member) {
  return `${member.claimId}@${member.revision}`;
}

function dependencyPayload(dependency, memberKeys) {
  if (!dependency || typeof dependency !== "object") throw new FrontierContextCompileError("context dependency is required");
  if (dependency.type !== "depends_on") throw new FrontierContextCompileError("context dependencies must use depends_on");
  const source = { claimId: requiredText(dependency.sourceClaimId, "dependency source claim id"), revision: positiveInteger(dependency.sourceRevision, "dependency source revision") };
  const target = { claimId: requiredText(dependency.targetClaimId, "dependency target claim id"), revision: positiveInteger(dependency.targetRevision, "dependency target revision") };
  if (!memberKeys.has(memberKey(source)) || !memberKeys.has(memberKey(target))) {
    throw new FrontierContextCompileError("context dependency endpoint is outside the fixed frontier", "FRONTIER_DEPENDENCY_NOT_PINNED");
  }
  return { type: "depends_on", source, target };
}

/**
 * Produce a canonical Frontier ContextBundle payload. It contains only the
 * requested Task revision, its fixed Frontier snapshot, member Claim revisions,
 * and revision-pinned dependencies between those members.
 */
export function compileFrontierContext({ taskRevision, frontierSnapshot, frontierMembers, dependencies = [] } = {}) {
  const task = taskPayload(taskRevision);
  const frontier = snapshotPayload(frontierSnapshot);
  if (!Array.isArray(frontierMembers) || frontierMembers.length === 0) {
    throw new FrontierContextCompileError("frontier members must be a non-empty array");
  }
  if (!Array.isArray(dependencies)) throw new FrontierContextCompileError("context dependencies must be an array");

  const members = frontierMembers.map((member) => memberPayload(member, frontier.snapshotId));
  const memberKeys = new Set();
  for (const member of members) {
    const key = memberKey(member);
    if (memberKeys.has(key)) throw new FrontierContextCompileError("frontier member is duplicated", "FRONTIER_MEMBER_DUPLICATE");
    memberKeys.add(key);
  }
  const compiledDependencies = dependencies.map((dependency) => dependencyPayload(dependency, memberKeys));
  members.sort((left, right) => memberKey(left).localeCompare(memberKey(right)) || left.membershipType.localeCompare(right.membershipType));
  compiledDependencies.sort((left, right) => `${memberKey(left.source)}>${memberKey(left.target)}`.localeCompare(`${memberKey(right.source)}>${memberKey(right.target)}`));

  return {
    version: 1,
    mode: "frontier",
    task,
    frontier: { ...frontier, members },
    dependencies: compiledDependencies,
  };
}

/**
 * Worker entry point. The repository adapter must return immutable revision
 * rows; it must not substitute a current Claim projection for a Frontier member.
 */
export async function compileFrontierContextJob({ repository, taskId, taskRevision, frontierSnapshotId } = {}) {
  if (!repository || ["getTaskRevision", "getFrontierSnapshot", "listFrontierMembers", "getClaimRevision", "listFrontierDependencies"].some((method) => typeof repository[method] !== "function")) {
    throw new FrontierContextCompileError("repository frontier context methods are required");
  }
  taskId = requiredText(taskId, "task id");
  taskRevision = positiveInteger(taskRevision, "task revision");
  frontierSnapshotId = requiredText(frontierSnapshotId, "frontier snapshot id");
  const [task, frontier, members] = await Promise.all([
    repository.getTaskRevision(taskId, taskRevision),
    repository.getFrontierSnapshot(frontierSnapshotId),
    repository.listFrontierMembers(frontierSnapshotId),
  ]);
  if (!task) throw new FrontierContextCompileError("task revision not found", "TASK_REVISION_NOT_FOUND");
  if (!frontier) throw new FrontierContextCompileError("frontier snapshot not found", "FRONTIER_SNAPSHOT_NOT_FOUND");
  const hydratedMembers = await Promise.all((members ?? []).map(async (member) => ({
    ...member,
    claimRevisionData: await repository.getClaimRevision(member.claimId, member.claimRevision),
  })));
  const dependencies = await repository.listFrontierDependencies({ frontierSnapshotId, members: hydratedMembers.map(({ claimId, claimRevision }) => ({ claimId, revision: claimRevision })) });
  return compileFrontierContext({ taskRevision: task, frontierSnapshot: frontier, frontierMembers: hydratedMembers, dependencies });
}
