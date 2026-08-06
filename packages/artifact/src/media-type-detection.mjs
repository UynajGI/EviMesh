export class MediaTypeDetectionError extends Error {
  constructor(message, code = 'MEDIA_TYPE_DETECTION_INVALID') {
    super(message);
    this.name = 'MediaTypeDetectionError';
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new MediaTypeDetectionError(`${field} must be a non-empty string`);
  return value.trim();
}

function mediaType(value, field) {
  value = requiredText(value, field).toLowerCase();
  if (!/^[^\s/]+\/[^\s/]+$/.test(value)) throw new MediaTypeDetectionError(`${field} must be type/subtype`);
  return value;
}

/** Detect an Artifact's media type and return a durable Finding when it conflicts with the declaration. */
export async function detectArtifactMediaType({ detector, artifactId, revision, expectedMediaType, object } = {}) {
  if (typeof detector !== 'function') throw new MediaTypeDetectionError('detector must be a function');
  artifactId = requiredText(artifactId, 'artifactId');
  if (!Number.isInteger(revision) || revision < 1) throw new MediaTypeDetectionError('revision must be a positive integer');
  expectedMediaType = mediaType(expectedMediaType, 'expectedMediaType');
  const actualMediaType = mediaType(await detector({ artifactId, revision, object }), 'detector result');
  if (actualMediaType === expectedMediaType) return Object.freeze({ matches: true, actualMediaType, finding: null });
  return Object.freeze({
    matches: false,
    actualMediaType,
    finding: Object.freeze({ code: 'ARTIFACT_MEDIA_TYPE_MISMATCH', severity: 'warning', artifactId, revision, expectedMediaType, actualMediaType }),
  });
}
