const TOKEN_PREFIX = "evimesh_";
const TOKEN_RANDOM_BYTES = 32;
const TOKEN_PREFIX_LENGTH = 16;
export const API_TOKEN_SCOPES = Object.freeze([
  "profile:read",
  "project:read",
  "research:prepare",
  "research:submit",
  "artifact:upload",
]);
const API_TOKEN_SCOPE_SET = new Set(API_TOKEN_SCOPES);

export class ApiTokenError extends Error {
  constructor(message, code = "API_TOKEN_INVALID") {
    super(message);
    this.name = "ApiTokenError";
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiTokenError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeScopes(scopes, { allowEmpty = true } = {}) {
  if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== "string" || scope.trim().length === 0)) {
    throw new ApiTokenError("scopes must be an array of non-empty strings");
  }
  const unique = new Set(scopes.map((scope) => scope.trim()));
  const unsupported = [...unique].find((scope) => !API_TOKEN_SCOPE_SET.has(scope));
  if (unsupported) {
    throw new ApiTokenError(`unsupported API token scope: ${unsupported}`, "API_TOKEN_SCOPE_INVALID");
  }
  if (!allowEmpty && unique.size === 0) {
    throw new ApiTokenError("at least one registered API token scope is required", "API_TOKEN_SCOPE_INVALID");
  }
  return API_TOKEN_SCOPES.filter((scope) => unique.has(scope));
}

function normalizeRequiredScopes(scopes, field) {
  return normalizeScopes(scopes).map((scope) => requiredText(scope, field));
}

function defaultTokenFactory() {
  const bytes = new Uint8Array(TOKEN_RANDOM_BYTES);
  crypto.getRandomValues(bytes);
  return `${TOKEN_PREFIX}${Buffer.from(bytes).toString("base64url")}`;
}

async function defaultDigestFactory(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("base64url");
}

/** Create an API token, returning its plaintext exactly once to the caller. */
export async function createActorApiToken({
  repository,
  actorId,
  scopes = API_TOKEN_SCOPES,
  expiresAt = null,
  issuanceContext,
  tokenFactory = defaultTokenFactory,
  digestFactory = defaultDigestFactory,
} = {}) {
  if (issuanceContext !== "device_authorization") {
    throw new ApiTokenError(
      "API tokens are issued only by Device Authorization consume",
      "API_TOKEN_DEVICE_AUTH_REQUIRED",
    );
  }
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new ApiTokenError("repository withTransaction is required");
  }
  if (typeof repository.insertApiToken !== "function") {
    throw new ApiTokenError("repository insertApiToken is required");
  }
  actorId = requiredText(actorId, "actor id");
  scopes = normalizeScopes(scopes, { allowEmpty: false });
  if (expiresAt !== null && !(expiresAt instanceof Date) && typeof expiresAt !== "string") {
    throw new ApiTokenError("expiresAt must be a Date, string, or null");
  }
  if (typeof tokenFactory !== "function" || typeof digestFactory !== "function") {
    throw new ApiTokenError("tokenFactory and digestFactory must be functions");
  }

  const plaintext = await tokenFactory();
  if (typeof plaintext !== "string" || !/^evimesh_[A-Za-z0-9_-]{43}$/.test(plaintext)) {
    throw new ApiTokenError("tokenFactory returned an invalid token");
  }
  const tokenHash = await digestFactory(plaintext);
  if (typeof tokenHash !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(tokenHash)) {
    throw new ApiTokenError("digestFactory returned an invalid digest");
  }
  const record = {
    actorId,
    tokenHash,
    tokenPrefix: plaintext.slice(0, TOKEN_PREFIX_LENGTH),
    scopes,
    expiresAt,
  };

  const persisted = await repository.withTransaction(async (transaction) => transaction.insertApiToken(record));
  return { token: plaintext, record: persisted ?? record };
}

/** Reject a request unless the token contains every required scope. */
export function assertApiTokenScopes({ grantedScopes, requiredScopes } = {}) {
  const granted = new Set(normalizeScopes(grantedScopes));
  const required = normalizeRequiredScopes(requiredScopes, "scope");
  const missing = required.filter((scope) => !granted.has(scope));
  if (missing.length > 0) {
    throw new ApiTokenError(`missing required scope: ${missing[0]}`, "API_TOKEN_SCOPE_FORBIDDEN");
  }
  return true;
}

/** Revoke a token only when it belongs to the authenticated Actor. */
export async function revokeActorApiToken({ repository, actorId, tokenId, reason } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new ApiTokenError("repository withTransaction is required");
  }
  if (typeof repository.revokeOwnedAgentToken !== "function") {
    throw new ApiTokenError("repository revokeOwnedAgentToken is required");
  }
  actorId = requiredText(actorId, "actor id");
  tokenId = requiredText(tokenId, "token id");
  reason = requiredText(reason, "revocation reason");
  return repository.withTransaction(async (transaction) => {
    const revoked = await transaction.revokeOwnedAgentToken(actorId, tokenId, reason);
    if (!revoked) {
      throw new ApiTokenError("active API token not found", "API_TOKEN_NOT_FOUND");
    }
    return revoked;
  });
}

/** Rotate from one Device-Authorization-issued Agent token to another. */
export async function rotateActorApiToken({ repository, actorId, oldTokenId, newTokenId, reason } = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new ApiTokenError("repository withTransaction is required");
  }
  if (typeof repository.rotateOwnedAgentToken !== "function") {
    throw new ApiTokenError("repository rotateOwnedAgentToken is required");
  }
  actorId = requiredText(actorId, "actor id");
  oldTokenId = requiredText(oldTokenId, "old token id");
  newTokenId = requiredText(newTokenId, "new token id");
  reason = requiredText(reason, "rotation reason");
  if (oldTokenId === newTokenId) throw new ApiTokenError("rotation token ids must be distinct");
  return repository.withTransaction((transaction) => transaction.rotateOwnedAgentToken(
    actorId,
    oldTokenId,
    newTokenId,
    reason,
  ));
}

/** List safe token metadata for Agents managed by the authenticated human. */
export async function listOwnedAgentApiTokens({ repository, actorId } = {}) {
  if (!repository || typeof repository.listOwnedAgentTokens !== "function") {
    throw new ApiTokenError("repository listOwnedAgentTokens is required");
  }
  return repository.listOwnedAgentTokens(requiredText(actorId, "actor id"));
}

/** Record successful use without changing token ownership or scopes. */
export async function markApiTokenUsed({ repository, tokenId, usedAt = new Date() } = {}) {
  if (!repository || typeof repository.markApiTokenUsed !== "function") {
    throw new ApiTokenError("repository markApiTokenUsed is required");
  }
  tokenId = requiredText(tokenId, "token id");
  if (!(usedAt instanceof Date) || Number.isNaN(usedAt.getTime())) {
    throw new ApiTokenError("usedAt must be a valid Date");
  }
  const updated = await repository.markApiTokenUsed(tokenId, usedAt);
  if (!updated) {
    throw new ApiTokenError("API token not found", "API_TOKEN_NOT_FOUND");
  }
  return updated;
}
