import { artifactObjectKey } from './hash.mjs';

const DEFAULT_EXPIRY_SECONDS = 300;
const MAX_EXPIRY_SECONDS = 3600;

export class DownloadRedirectError extends Error {
  constructor(message, code = 'DOWNLOAD_REDIRECT_INVALID') {
    super(message);
    this.name = 'DownloadRedirectError';
    this.code = code;
  }
}

function validNow(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new DownloadRedirectError('now must be a valid Date');
  return now;
}

function validExpiry(seconds) {
  if (!Number.isInteger(seconds) || seconds < 60 || seconds > MAX_EXPIRY_SECONDS) throw new DownloadRedirectError(`expiry must be an integer between 60 and ${MAX_EXPIRY_SECONDS} seconds`);
  return seconds;
}

/** Create a short-lived signed GET redirect for a content-addressed Artifact. */
export async function createDownloadRedirect({ artifactId, revision, rawHash, signer, expiresInSeconds = DEFAULT_EXPIRY_SECONDS, now = new Date() } = {}) {
  if (typeof signer !== 'function') throw new DownloadRedirectError('download signer is required');
  const issuedAt = validNow(now);
  const expiresAt = new Date(issuedAt.getTime() + validExpiry(expiresInSeconds) * 1000);
  const key = artifactObjectKey({ artifactId, revision, rawHash });
  const signed = await signer({ key, method: 'GET', expiresAt });
  let url;
  try {
    url = new URL(signed?.url);
  } catch {
    throw new DownloadRedirectError('download signer returned an invalid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new DownloadRedirectError('download signer returned an invalid URL');
  return Object.freeze({ status: 302, location: signed.url, key, issuedAt, expiresAt });
}
