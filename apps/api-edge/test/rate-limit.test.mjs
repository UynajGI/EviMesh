import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, rateLimitSettings } from '../src/rate-limit.mjs';

test('rate limiter keeps Actor and API Token buckets independent', () => {
  let time = 0;
  const limiter = createRateLimiter({ now: () => time });
  const actor = { scope: 'actor', key: 'actor-1', limit: 2, windowMs: 1_000 };
  const tokenA = { scope: 'api_token', key: 'token-a', limit: 1, windowMs: 1_000 };
  const tokenB = { scope: 'api_token', key: 'token-b', limit: 1, windowMs: 1_000 };

  assert.equal(limiter.consume(actor).allowed, true);
  assert.equal(limiter.consume(tokenA).allowed, true);
  assert.equal(limiter.consume(tokenA).allowed, false);
  assert.equal(limiter.consume(tokenB).allowed, true);
  assert.equal(limiter.consume(actor).allowed, true);
  assert.equal(limiter.consume(actor).allowed, false);

  time = 1_000;
  assert.equal(limiter.consume(tokenA).allowed, true);
});

test('rate limit settings use positive environment values and safe defaults', () => {
  assert.deepEqual(rateLimitSettings({ ACTOR_RATE_LIMIT_MAX: '4', API_TOKEN_RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_SECONDS: '15' }), {
    actorLimit: 4, apiTokenLimit: 2, windowMs: 15_000,
  });
  assert.deepEqual(rateLimitSettings({ ACTOR_RATE_LIMIT_MAX: '0', API_TOKEN_RATE_LIMIT_MAX: 'bad', RATE_LIMIT_WINDOW_SECONDS: '-1' }), {
    actorLimit: 120, apiTokenLimit: 60, windowMs: 60_000,
  });
});
