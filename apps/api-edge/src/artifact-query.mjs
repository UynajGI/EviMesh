import { paginate } from "./pagination.mjs";

export class ArtifactQueryError extends Error {
  constructor(message, code = "ARTIFACT_QUERY_INVALID", status = 400) {
    super(message);
    this.name = "ArtifactQueryError";
    this.code = code;
    this.status = status;
  }
}

function optionalFilter(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) throw new ArtifactQueryError(`${field} must be a non-empty string, null, or undefined`);
  return value.trim();
}

function paginationOptions({ limit, cursor }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ArtifactQueryError("limit must be an integer between 1 and 100");
  if (cursor !== null && cursor !== undefined && (typeof cursor !== "string" || cursor.length === 0)) throw new ArtifactQueryError("cursor must be a non-empty string or null");
  return { limit, cursor: cursor ?? null };
}

function requireRepository(repository, methods, message) {
  if (!repository || methods.some((method) => typeof repository[method] !== "function")) throw new ArtifactQueryError(message);
}

function requiredId(value) {
  if (typeof value !== "string" || value.trim().length === 0) throw new ArtifactQueryError("artifact id must be a non-empty string");
  return value.trim();
}

export async function listArtifacts({ repository, artifactType = null, createdBy = null, limit = 20, cursor = null } = {}) {
  requireRepository(repository, ["listArtifacts"], "repository listArtifacts is required");
  const artifacts = await repository.listArtifacts({
    artifactType: optionalFilter(artifactType, "artifact type"),
    createdBy: optionalFilter(createdBy, "created by"),
  });
  return paginate(artifacts, { ...paginationOptions({ limit, cursor }), getKey: (artifact) => ({ createdAt: artifact.createdAt, id: artifact.artifactId }) });
}

export async function getArtifact({ repository, artifactId } = {}) {
  artifactId = requiredId(artifactId);
  requireRepository(repository, ["getArtifact", "getCurrentArtifactRevision", "listArtifactLocations"], "repository artifact detail methods are required");
  const artifact = await repository.getArtifact(artifactId);
  if (!artifact) throw new ArtifactQueryError("artifact not found", "ARTIFACT_NOT_FOUND", 404);
  const [currentRevision, locations] = await Promise.all([
    repository.getCurrentArtifactRevision(artifactId),
    repository.listArtifactLocations(artifactId),
  ]);
  if (!currentRevision) throw new ArtifactQueryError("current artifact revision not found", "ARTIFACT_REVISION_NOT_FOUND", 500);
  return { artifact, currentRevision, locations: Array.isArray(locations) ? locations : [] };
}

export async function getArtifactRevision({ repository, artifactId, revision } = {}) {
  artifactId = requiredId(artifactId);
  if (!Number.isInteger(revision) || revision < 1) throw new ArtifactQueryError("artifact revision must be a positive integer");
  requireRepository(repository, ["getArtifactRevision"], "repository getArtifactRevision is required");
  const artifactRevision = await repository.getArtifactRevision(artifactId, revision);
  if (!artifactRevision) throw new ArtifactQueryError("artifact revision not found", "ARTIFACT_REVISION_NOT_FOUND", 404);
  return artifactRevision;
}
