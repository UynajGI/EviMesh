import { assertProjectRoleForAction } from "./project-authorization.mjs";

export class ProjectCommandError extends Error {
  constructor(message, code = "PROJECT_INVALID", status = 400) {
    super(message);
    this.name = "ProjectCommandError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectCommandError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeActorIds(actorIds, ownerId) {
  if (!Array.isArray(actorIds) || actorIds.some((actorId) => typeof actorId !== "string" || actorId.trim().length === 0)) {
    throw new ProjectCommandError("maintainer ids must be an array of non-empty strings");
  }
  return [...new Set([ownerId, ...actorIds.map((actorId) => actorId.trim())])];
}

function assertRepository(repository) {
  const methods = [
    "insertProject",
    "insertProjectRevision",
    "insertProjectMember",
    "appendResearchEvent",
  ];
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new ProjectCommandError("repository withTransaction is required");
  }
  for (const method of methods) {
    if (typeof repository[method] !== "function") {
      throw new ProjectCommandError(`repository ${method} is required`);
    }
  }
}

/**
 * Create a Project and its first immutable revision in one transaction.
 * The eventFactory supplies the signed, hash-addressed ResearchEvent envelope.
 */
export async function createProject({
  repository,
  actorId,
  projectId,
  name,
  summary,
  license,
  maintainerIds = [],
  eventFactory,
} = {}) {
  assertRepository(repository);
  actorId = requiredText(actorId, "actor id");
  projectId = requiredText(projectId, "project id");
  name = requiredText(name, "project name");
  summary = requiredText(summary, "project summary");
  license = requiredText(license, "project license");
  if (typeof eventFactory !== "function") {
    throw new ProjectCommandError("eventFactory is required");
  }

  const maintainers = normalizeActorIds(maintainerIds, actorId);
  assertProjectRoleForAction({ actorRole: "owner", requiredRole: "owner" });
  const project = {
    projectId,
    state: "draft",
    name,
    summary,
    createdBy: actorId,
    license,
  };
  const revision = {
    projectId,
    revision: 1,
    supersedes: null,
    state: "draft",
    name,
    summary,
    createdBy: actorId,
    maintainerIds: maintainers,
    license,
  };
  const member = { projectId, actorId, role: "owner" };
  const eventPayload = {
    entity_type: "project",
    project_id: projectId,
    revision: 1,
    actor_id: actorId,
  };
  const event = await eventFactory({ eventType: "project.created", payload: eventPayload });
  if (!event || typeof event !== "object") {
    throw new ProjectCommandError("eventFactory must return an event object");
  }

  return repository.withTransaction(async (transaction) => {
    const persistedProject = await transaction.insertProject(project);
    const persistedRevision = await transaction.insertProjectRevision(revision);
    const persistedMember = await transaction.insertProjectMember(member);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return {
      project: persistedProject ?? project,
      revision: persistedRevision ?? revision,
      member: persistedMember ?? member,
      event: persistedEvent ?? event,
    };
  });
}

function assertIfMatch(ifMatch, currentEtag) {
  if (typeof ifMatch !== "string" || ifMatch.trim().length === 0 || ifMatch.trim() !== currentEtag) {
    throw new ProjectCommandError("If-Match does not match the current revision", "PRECONDITION_FAILED", 412);
  }
}

/** Append a Project revision without mutating the historical revision row. */
export async function reviseProject({
  repository,
  actorId,
  projectId,
  ifMatch,
  currentEtag,
  name,
  summary,
  license,
  maintainerIds,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new ProjectCommandError("repository withTransaction is required");
  }
  for (const method of ["getCurrentProjectRevision", "insertProjectRevision", "updateProject", "appendResearchEvent"]) {
    if (typeof repository[method] !== "function") {
      throw new ProjectCommandError(`repository ${method} is required`);
    }
  }
  actorId = requiredText(actorId, "actor id");
  projectId = requiredText(projectId, "project id");
  if (typeof currentEtag !== "string" || currentEtag.length === 0) {
    throw new ProjectCommandError("current ETag is required");
  }
  if (typeof eventFactory !== "function") {
    throw new ProjectCommandError("eventFactory is required");
  }

  return repository.withTransaction(async (transaction) => {
    const current = await transaction.getCurrentProjectRevision(projectId);
    if (!current) {
      throw new ProjectCommandError("current project revision not found", "PROJECT_REVISION_NOT_FOUND", 404);
    }
    assertIfMatch(ifMatch, currentEtag);
    const next = {
      projectId,
      revision: current.revision + 1,
      supersedes: current.revision,
      state: current.state,
      name: name === undefined ? current.name : requiredText(name, "project name"),
      summary: summary === undefined ? current.summary : requiredText(summary, "project summary"),
      createdBy: actorId,
      maintainerIds: maintainerIds === undefined ? current.maintainerIds : normalizeActorIds(maintainerIds, actorId),
      license: license === undefined ? current.license : requiredText(license, "project license"),
    };
    const event = await eventFactory({
      eventType: "project.revised",
      payload: { entity_type: "project", project_id: projectId, revision: next.revision, actor_id: actorId },
    });
    if (!event || typeof event !== "object") {
      throw new ProjectCommandError("eventFactory must return an event object");
    }
    const projected = {
      projectId,
      state: next.state,
      name: next.name,
      summary: next.summary,
      license: next.license,
    };
    const persistedRevision = await transaction.insertProjectRevision(next);
    const persistedProject = await transaction.updateProject(projectId, projected);
    const persistedEvent = await transaction.appendResearchEvent(event);
    return {
      project: persistedProject ?? projected,
      revision: persistedRevision ?? next,
      event: persistedEvent ?? event,
    };
  });
}
