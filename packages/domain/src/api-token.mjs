const TOKEN_PREFIX = "evimesh_";
const TOKEN_RANDOM_BYTES = 32;
const TOKEN_PREFIX_LENGTH = 16;

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

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== "string" || scope.trim().length === 0)) {
    throw new ApiTokenError("scopes must be an array of non-empty strings");
  }
  return [...new Set(scopes.map((scope) => scope.trim()))].sort();
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
  scopes = [],
  expiresAt = null,
  tokenFactory = defaultTokenFactory,
  digestFactory = defaultDigestFactory,
} = {}) {
  if (!repository || typeof repository.withTransaction !== "function") {
    throw new ApiTokenError("repository withTransaction is required");
  }
  if (typeof repository.insertApiToken !== "function") {
    throw new ApiTokenError("repository insertApiToken is required");
  }
  actorId = requiredText(actorId, "actor id");
  scopes = normalizeScopes(scopes);
  if (expiresAt !== null && !(expiresAt instanceof Date) && typeof expiresAt !== "string") {
    throw new ApiTokenError("expiresAt must be a Date, string, or null");
  }
  if (typeof tokenFactory !== "function" || typeof digestFactory !== "function") {
    throw new ApiTokenError("tokenFactory and digestFactory must be functions");
  }

  const plaintext = await tokenFactory();
  if (typeof plaintext !== "string" || plaintext.length < TOKEN_PREFIX.length + 16) {
    throw new ApiTokenError("tokenFactory returned an invalid token");
  }
  const tokenHash = await digestFactory(plaintext);
  if (typeof tokenHash !== "string" || tokenHash.length === 0) {
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
