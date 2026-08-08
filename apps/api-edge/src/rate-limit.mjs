const DEFAULT_WINDOW_MS = 60_000;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function rateLimitSettings(env = {}) {
  return {
    actorLimit: positiveInteger(env.ACTOR_RATE_LIMIT_MAX, 120),
    apiTokenLimit: positiveInteger(env.API_TOKEN_RATE_LIMIT_MAX, 60),
    windowMs: positiveInteger(env.RATE_LIMIT_WINDOW_SECONDS, 60) * 1_000,
  };
}

/**
 * A small fixed-window limiter with an injectable clock. Production bindings can
 * replace this with a shared limiter; keeping the contract local makes route
 * behavior deterministic in tests and explicit about its keys.
 */
export function createRateLimiter({ now = () => Date.now() } = {}) {
  const buckets = new Map();

  function consume({ scope, key, limit, windowMs }) {
    if (typeof scope !== 'string' || !scope || typeof key !== 'string' || !key) {
      throw new TypeError('rate limit scope and key are required');
    }
    const safeLimit = positiveInteger(limit, 1);
    const safeWindowMs = positiveInteger(windowMs, DEFAULT_WINDOW_MS);
    const currentTime = now();
    const bucketKey = `${scope}:${key}`;
    const current = buckets.get(bucketKey);
    const active = current && currentTime < current.resetAt
      ? current
      : { count: 0, resetAt: currentTime + safeWindowMs };

    active.count += 1;
    buckets.set(bucketKey, active);
    const retryAfterSeconds = Math.max(1, Math.ceil((active.resetAt - currentTime) / 1_000));
    return {
      allowed: active.count <= safeLimit,
      remaining: Math.max(0, safeLimit - active.count),
      retryAfterSeconds,
    };
  }

  return { consume };
}
