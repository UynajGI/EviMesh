import { paginate } from "./pagination.mjs";

export class ProjectQueryError extends Error {
  constructor(message, code = "PROJECT_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "ProjectQueryError";
    this.code = code;
    this.status = status;
  }
}

function requiredProjectId(projectId) {
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    throw new ProjectQueryError("project id must be a non-empty string");
  }
  return projectId.trim();
}

function assertListRepository(repository) {
  if (!repository || typeof repository.listProjects !== "function") {
    throw new ProjectQueryError("repository listProjects is required");
  }
}

/** List Project identity rows with stable, opaque cursor pagination. */
export async function listProjects({ repository, limit = 20, cursor = null, state = null } = {}) {
  assertListRepository(repository);
  if (state !== null && (typeof state !== "string" || state.trim().length === 0)) {
    throw new ProjectQueryError("project state must be a non-empty string or null");
  }
  const projects = await repository.listProjects({ state: state?.trim() ?? null });
  return paginate(projects, { limit, cursor });
}

/** Return a Project identity together with its current immutable revision. */
export async function getProject({ repository, projectId } = {}) {
  projectId = requiredProjectId(projectId);
  if (!repository || typeof repository.getProject !== "function" || typeof repository.getCurrentProjectRevision !== "function") {
    throw new ProjectQueryError("repository project detail methods are required");
  }
  const project = await repository.getProject(projectId);
  if (!project) {
    throw new ProjectQueryError("project not found", "PROJECT_NOT_FOUND", 404);
  }
  const currentRevision = await repository.getCurrentProjectRevision(projectId);
  if (!currentRevision) {
    throw new ProjectQueryError("current project revision not found", "PROJECT_REVISION_NOT_FOUND", 500);
  }
  return { project, currentRevision };
}
