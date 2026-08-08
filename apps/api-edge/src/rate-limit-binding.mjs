function requiredText(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} is required`);
  return value;
}

function normalizeResult(value) {
  if (!value || typeof value.allowed !== 'boolean' || !Number.isInteger(value.remaining) || !Number.isInteger(value.retryAfterSeconds)) {
    throw new TypeError('rate limiter Durable Object returned an invalid result');
  }
  return value;
}

/** Create a limiter backed by one deterministic Durable Object per bucket key. */
export function createDurableObjectRateLimiter(namespace, { now = () => Date.now() } = {}) {
  if (!namespace || typeof namespace.getByName !== 'function') {
    throw new TypeError('RATE_LIMITER Durable Object namespace is required');
  }

  return Object.freeze({
    async consume({ scope, key, limit, windowMs } = {}) {
      const bucketName = `${requiredText(scope, 'rate limit scope')}:${requiredText(key, 'rate limit key')}`;
      const stub = namespace.getByName(bucketName);
      if (!stub || typeof stub.consume !== 'function') throw new TypeError('rate limiter Durable Object stub is invalid');
      return normalizeResult(await stub.consume({ limit, windowMs, now: now() }));
    },
  });
}
