import test from 'node:test';
import assert from 'node:assert/strict';
import { createDurableObjectRateLimiter } from '../src/rate-limit-binding.mjs';
import { advanceRateLimitWindow } from '../src/rate-limit-store.mjs';

function sharedNamespace() {
  const states = new Map();
  return {
    names: [],
    getByName(name) {
      this.names.push(name);
      return {
        async consume(input) {
          const next = advanceRateLimitWindow({ state: states.get(name), ...input });
          states.set(name, next.state);
          return next.result;
        },
      };
    },
  };
}

test('separate Worker adapters share one deterministic actor bucket', async () => {
  const namespace = sharedNamespace();
  const firstIsolate = createDurableObjectRateLimiter(namespace, { now: () => 0 });
  const secondIsolate = createDurableObjectRateLimiter(namespace, { now: () => 0 });
  const input = { scope: 'actor', key: 'actor-1', limit: 2, windowMs: 1_000 };

  assert.equal((await firstIsolate.consume(input)).allowed, true);
  assert.equal((await secondIsolate.consume(input)).allowed, true);
  assert.equal((await firstIsolate.consume(input)).allowed, false);
  assert.deepEqual(new Set(namespace.names), new Set(['actor:actor-1']));
});

test('API token buckets stay independent while sharing the namespace', async () => {
  const namespace = sharedNamespace();
  const limiter = createDurableObjectRateLimiter(namespace, { now: () => 0 });
  const input = { scope: 'api_token', limit: 1, windowMs: 1_000 };

  assert.equal((await limiter.consume({ ...input, key: 'token-a' })).allowed, true);
  assert.equal((await limiter.consume({ ...input, key: 'token-a' })).allowed, false);
  assert.equal((await limiter.consume({ ...input, key: 'token-b' })).allowed, true);
});

test('fixed window resets deterministically', () => {
  const first = advanceRateLimitWindow({ limit: 1, windowMs: 1_000, now: 0 });
  assert.equal(first.result.allowed, true);
  const denied = advanceRateLimitWindow({ state: first.state, limit: 1, windowMs: 1_000, now: 999 });
  assert.equal(denied.result.allowed, false);
  const reset = advanceRateLimitWindow({ state: denied.state, limit: 1, windowMs: 1_000, now: 1_000 });
  assert.equal(reset.result.allowed, true);
});
