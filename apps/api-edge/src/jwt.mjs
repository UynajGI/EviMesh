const textEncoder = new TextEncoder();

export class JwtVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "JwtVerificationError";
  }
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson(value, field) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  } catch {
    throw new JwtVerificationError(`invalid JWT ${field}`);
  }
}

function assertClaims(claims, { issuer, audience, now }) {
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new JwtVerificationError("JWT subject is required");
  }
  if (issuer && claims.iss !== issuer) {
    throw new JwtVerificationError("JWT issuer is invalid");
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (audience && !audiences.includes(audience)) {
    throw new JwtVerificationError("JWT audience is invalid");
  }
  if (!Number.isFinite(claims.exp) || claims.exp <= now) {
    throw new JwtVerificationError("JWT is expired or has no expiry");
  }
  if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) {
    throw new JwtVerificationError("JWT is not active");
  }
}

function findKey(jwks, kid) {
  const key = jwks?.keys?.find((candidate) => candidate.kid === kid);
  if (!key || key.kty !== "EC" || key.crv !== "P-256" || (key.alg && key.alg !== "ES256")) {
    throw new JwtVerificationError("JWT signing key is unavailable");
  }
  return key;
}

export async function verifySupabaseJwt(token, { jwks, issuer, audience = "authenticated", now = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof token !== "string") {
    throw new JwtVerificationError("JWT is required");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtVerificationError("JWT format is invalid");
  }

  const header = decodeJson(parts[0], "header");
  const claims = decodeJson(parts[1], "payload");
  if (header.alg !== "ES256" || header.typ !== "JWT" || typeof header.kid !== "string") {
    throw new JwtVerificationError("JWT header is invalid");
  }
  assertClaims(claims, { issuer, audience, now });

  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      findKey(jwks, header.kid),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new JwtVerificationError("JWT signing key is invalid");
  }

  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    decodeBase64Url(parts[2]),
    textEncoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) {
    throw new JwtVerificationError("JWT signature is invalid");
  }
  return claims;
}

export async function authenticateSupabaseRequest(request, env, fetchImpl = fetch) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    throw new JwtVerificationError("Bearer token is required");
  }

  const jwksUrl = env.SUPABASE_JWKS_URL || (env.SUPABASE_URL
    ? `${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`
    : undefined);
  const jwks = env.SUPABASE_JWKS
    ? JSON.parse(env.SUPABASE_JWKS)
    : await (await fetchImpl(jwksUrl)).json();
  const issuer = env.SUPABASE_JWT_ISSUER || (env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1` : undefined);
  return verifySupabaseJwt(match[1], {
    jwks,
    issuer,
    audience: env.SUPABASE_JWT_AUDIENCE || "authenticated",
  });
}
