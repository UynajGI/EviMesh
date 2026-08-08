const DEFAULT_WINDOW_MS = 60_000;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Advance one fixed-window bucket without performing I/O. */
export function advanceRateLimitWindow({ state = null, limit, windowMs, now = Date.now() } = {}) {
  const safeLimit = positiveInteger(limit, 1);
  const safeWindowMs = positiveInteger(windowMs, DEFAULT_WINDOW_MS);
  if (!Number.isFinite(now) || now < 0) throw new TypeError('rate limit time must be a non-negative number');

  const active = state
    && Number.isInteger(state.count)
    && state.count >= 0
    && Number.isFinite(state.resetAt)
    && now < state.resetAt
    ? state
    : { count: 0, resetAt: now + safeWindowMs };
  const next = { count: active.count + 1, resetAt: active.resetAt };

  return Object.freeze({
    state: Object.freeze(next),
    result: Object.freeze({
      allowed: next.count <= safeLimit,
      remaining: Math.max(0, safeLimit - next.count),
      retryAfterSeconds: Math.max(1, Math.ceil((next.resetAt - now) / 1_000)),
    }),
  });
}
