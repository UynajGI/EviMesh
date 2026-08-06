import { assertProjectRoleForAction } from './project-authorization.mjs';

const ARTIFACT_TYPES = new Set(['code', 'dataset', 'document', 'figure', 'proof', 'notebook', 'container', 'model', 'report', 'other']);

export class ArtifactCommandError extends Error {
  constructor(message, code = 'ARTIFACT_INVALID', status = 400) {
    super(message);
    this.name = 'ArtifactCommandError';
    this.code = code;
    this.status = status;
  }
}
function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ArtifactCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new ArtifactCommandError(`${field} must be a non-negative integer`);
  return value;
}

function assertUri(value) {
  const uri = requiredText(value, 'location');
  if (!/^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/.test(uri)) throw new ArtifactCommandError('location must be an absolute URI');
  return uri;
}

/** Create an Artifact, immutable first revision, and initial location atomically. */
export async function createArtifact({
  repository,
  actorId,
  actorRole,
  artifactId,
  artifactType,
  rawHash,
  semanticHash = null,
  sizeBytes,
  mediaType,
  license,
  description = null,
  locationId,
  location,
  eventFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== 'function') throw new ArtifactCommandError('repository withTransaction is required');
  for (const method of ['insertArtifact', 'insertArtifactRevision', 'insertArtifactLocation', 'appendResearchEvent']) {
    if (typeof repository[method] !== 'function') throw new ArtifactCommandError(`repository ${method} is required`);
  }
  actorId = requiredText(actorId, 'actor id');
  artifactId = requiredText(artifactId, 'artifact id');
  artifactType = requiredText(artifactType, 'artifact type');
  if (!ARTIFACT_TYPES.has(artifactType)) throw new ArtifactCommandError(`unsupported artifact type: ${artifactType}`);
  if (typeof rawHash !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(rawHash)) throw new ArtifactCommandError('raw hash must be a sha256 digest');
  if (semanticHash !== null && (typeof semanticHash !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(semanticHash))) throw new ArtifactCommandError('semantic hash must be a sha256 digest or null');
  sizeBytes = assertPositiveInteger(sizeBytes, 'size bytes');
  mediaType = requiredText(mediaType, 'media type');
  if (!/^[^\s/]+\/[^\s/]+$/.test(mediaType)) throw new ArtifactCommandError('media type must be type/subtype');
  license = requiredText(license, 'license');
  if (description !== null) description = requiredText(description, 'description');
  locationId = requiredText(locationId, 'location id');
  location = assertUri(location);
  if (typeof eventFactory !== 'function') throw new ArtifactCommandError('eventFactory is required');
  assertProjectRoleForAction({ actorRole, requiredRole: 'contributor' });

  const artifact = { artifactId, createdBy: actorId };
  const revision = { artifactId, revision: 1, supersedes: null, artifactType, rawHash: rawHash.toLowerCase(), semanticHash: semanticHash?.toLowerCase() ?? null, sizeBytes, mediaType, license, description, createdBy: actorId };
  const artifactLocation = { locationId, artifactId, locationType: 'primary', uri: location, createdBy: actorId };
  const event = await eventFactory({ eventType: 'artifact.created', payload: { entity_type: 'artifact', artifact_id: artifactId, revision: 1, actor_id: actorId, raw_hash: revision.rawHash } });
  if (!event || typeof event !== 'object') throw new ArtifactCommandError('eventFactory must return an event object');

  return repository.withTransaction(async (transaction) => ({
    artifact: await transaction.insertArtifact(artifact) ?? artifact,
    revision: await transaction.insertArtifactRevision(revision) ?? revision,
    location: await transaction.insertArtifactLocation(artifactLocation) ?? artifactLocation,
    event: await transaction.appendResearchEvent(event) ?? event,
  }));
}
