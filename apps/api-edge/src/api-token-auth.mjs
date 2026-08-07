import { JwtVerificationError } from "./jwt.mjs";

export const API_TOKEN_PREFIX = "evimesh_";

async function tokenDigest(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("base64url");
}

/**
 * Authenticate an opaque `evimesh_...` API token issued by the device-login
 * exchange (or the token API). Returns claims carrying the resolved actorId so
 * downstream actor resolution works identically to the Supabase JWT path.
 * Tokens are matched by SHA-256 hash; plaintext never reaches the repository.
 */
export async function authenticateApiToken({ repository, token, now = new Date() } = {}) {
  if (typeof token !== "string" || !token.startsWith(API_TOKEN_PREFIX)) {
    throw new JwtVerificationError("API token format is invalid");
  }
  if (!repository || typeof repository.findApiTokenByHash !== "function") {
    throw new JwtVerificationError("API token authentication is not configured");
  }
  const record = await repository.findApiTokenByHash(await tokenDigest(token));
  if (!record || record.revokedAt) {
    throw new JwtVerificationError("API token is invalid or revoked");
  }
  if (record.expiresAt !== null && record.expiresAt !== undefined && new Date(record.expiresAt) <= now) {
    throw new JwtVerificationError("API token is expired");
  }
  if (typeof record.actorId !== "string" || record.actorId.trim().length === 0) {
    throw new JwtVerificationError("API token actor is invalid");
  }
  if (typeof repository.updateApiTokenLastUsedAt === "function") {
    try {
      await repository.updateApiTokenLastUsedAt(record.tokenId, now);
    } catch {
      // Usage bookkeeping must not break authentication.
    }
  }
  return {
    kind: "api_token",
    sub: record.actorId.trim(),
    actorId: record.actorId.trim(),
    tokenId: record.tokenId ?? null,
    scopes: Array.isArray(record.scopes) ? [...record.scopes] : [],
  };
}
