export const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

const FORBIDDEN_MEDIA_TYPES = new Set([
  'application/x-msdownload',
  'application/x-dosexec',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
  'application/vnd.microsoft.portable-executable',
]);

const FORBIDDEN_EXTENSIONS = new Set([
  'ade', 'adp', 'app', 'apk', 'bat', 'cmd', 'com', 'cpl', 'dll', 'exe', 'hta',
  'inf', 'ins', 'iso', 'jar', 'js', 'jse', 'lnk', 'msi', 'msp', 'mst', 'pif',
  'ps1', 'reg', 'scr', 'sct', 'sh', 'vb', 'vbe', 'vbs', 'wsf', 'wsh',
]);

export class UploadPolicyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'UploadPolicyError';
    this.code = code;
  }
}

function normalizedMediaType(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new UploadPolicyError('media type is required', 'UPLOAD_MEDIA_TYPE_DENIED');
  }
  return value.trim().toLowerCase().split(';', 1)[0].trim();
}

function extensionOf(fileName) {
  if (fileName == null) return null;
  if (typeof fileName !== 'string' || fileName.trim().length === 0) {
    throw new UploadPolicyError('file name must be a non-empty string when provided', 'UPLOAD_MEDIA_TYPE_DENIED');
  }
  const leaf = fileName.trim().replace(/\\/g, '/').split('/').pop().toLowerCase();
  const dot = leaf.lastIndexOf('.');
  return dot > 0 && dot < leaf.length - 1 ? leaf.slice(dot + 1) : null;
}

/** Validate upload metadata before any signer or storage call is made. */
export function assertUploadPolicy({ sizeBytes, mediaType, fileName, maxSizeBytes = DEFAULT_MAX_UPLOAD_SIZE_BYTES } = {}) {
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0) {
    throw new UploadPolicyError('size bytes must be a non-negative integer', 'UPLOAD_SIZE_QUOTA_EXCEEDED');
  }
  if (!Number.isInteger(maxSizeBytes) || maxSizeBytes < 0) {
    throw new UploadPolicyError('maximum upload size must be a non-negative integer', 'UPLOAD_SIZE_QUOTA_EXCEEDED');
  }
  if (sizeBytes > maxSizeBytes) {
    throw new UploadPolicyError(`upload exceeds the ${maxSizeBytes}-byte quota`, 'UPLOAD_SIZE_QUOTA_EXCEEDED');
  }

  const normalized = normalizedMediaType(mediaType);
  if (FORBIDDEN_MEDIA_TYPES.has(normalized) || normalized.startsWith('application/x-msdownload')) {
    throw new UploadPolicyError(`media type ${normalized} is not allowed`, 'UPLOAD_MEDIA_TYPE_DENIED');
  }
  const extension = extensionOf(fileName);
  if (extension && FORBIDDEN_EXTENSIONS.has(extension)) {
    throw new UploadPolicyError(`file extension .${extension} is not allowed`, 'UPLOAD_MEDIA_TYPE_DENIED');
  }
  return Object.freeze({ mediaType: normalized, sizeBytes, fileName: fileName?.trim() ?? null, maxSizeBytes });
}
