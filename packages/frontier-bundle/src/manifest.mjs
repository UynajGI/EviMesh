import { createHash, randomUUID } from "node:crypto";
import { BUNDLE_SCHEMA, FILE_ROLES, roleForPath } from "./spec.mjs";

export class BundleManifestError extends Error {
  constructor(message, code = "BUNDLE_MANIFEST_INVALID") {
    super(message);
    this.name = "BundleManifestError";
    this.code = code;
  }
}

export function sha256Hex(bytes) {
  const buffer = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(String(bytes), "utf8");
  return createHash("sha256").update(buffer).digest("hex");
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new BundleManifestError(`${field} must be a non-empty string`);
  return value.trim();
}

/**
 * Build the bundle manifest (M12-02): every file entry carries its SHA-256
 * digest, byte size, and semantic role so the bundle is verifiable offline.
 */
export function buildManifest({ projectId, frontierSnapshotId, sequence, files, createdAt = new Date().toISOString(), bundleId = `bundle_${randomUUID()}` } = {}) {
  requiredText(projectId, "projectId");
  requiredText(frontierSnapshotId, "frontierSnapshotId");
  if (!Number.isInteger(sequence) || sequence < 1) throw new BundleManifestError("sequence must be a positive integer");
  if (!Array.isArray(files) || files.length === 0) throw new BundleManifestError("files must be a non-empty array");

  const entries = [];
  const seen = new Set();
  for (const file of files) {
    const path = requiredText(file.path, "file path");
    if (seen.has(path)) throw new BundleManifestError(`duplicate file path: ${path}`);
    seen.add(path);
    const role = file.role ?? roleForPath(path);
    if (!FILE_ROLES.includes(role)) throw new BundleManifestError(`file ${path} has unknown role: ${role}`);
    if (typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new BundleManifestError(`file ${path} needs a sha256 hex digest`);
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 0) throw new BundleManifestError(`file ${path} needs a non-negative sizeBytes`);
    entries.push({ path, sha256: file.sha256, sizeBytes: file.sizeBytes, role });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));

  return Object.freeze({
    schema: BUNDLE_SCHEMA,
    bundleId,
    projectId,
    frontierSnapshotId,
    sequence,
    createdAt,
    files: entries,
  });
}

/** Validate manifest structure; returns the manifest or throws. */
export function parseManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BundleManifestError("manifest must be an object");
  if (value.schema !== BUNDLE_SCHEMA) throw new BundleManifestError(`manifest schema must be ${BUNDLE_SCHEMA}`);
  requiredText(value.bundleId, "bundleId");
  requiredText(value.projectId, "projectId");
  requiredText(value.frontierSnapshotId, "frontierSnapshotId");
  if (!Number.isInteger(value.sequence) || value.sequence < 1) throw new BundleManifestError("sequence must be a positive integer");
  if (!Array.isArray(value.files) || value.files.length === 0) throw new BundleManifestError("files must be a non-empty array");
  for (const file of value.files) {
    if (!file || typeof file !== "object") throw new BundleManifestError("file entry must be an object");
    requiredText(file.path, "file path");
    if (typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new BundleManifestError(`file ${file.path} needs a sha256 hex digest`);
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 0) throw new BundleManifestError(`file ${file.path} needs a non-negative sizeBytes`);
    if (!FILE_ROLES.includes(file.role)) throw new BundleManifestError(`file ${file.path} has unknown role: ${file.role}`);
  }
  return value;
}
