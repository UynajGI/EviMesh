import { DurableObject } from 'cloudflare:workers';
import { advanceRateLimitWindow } from './rate-limit-store.mjs';

const STORAGE_KEY = 'fixed-window';

/** Strongly coordinated fixed-window bucket. One instance is used per actor/token key. */
export class RateLimitDurableObject extends DurableObject {
  async consume({ limit, windowMs, now = Date.now() } = {}) {
    return this.ctx.storage.transaction(async (transaction) => {
      const current = await transaction.get(STORAGE_KEY);
      const { state, result } = advanceRateLimitWindow({ state: current, limit, windowMs, now });
      await transaction.put(STORAGE_KEY, state);
      return result;
    });
  }
}
