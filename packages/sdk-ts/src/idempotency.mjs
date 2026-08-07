import { randomUUID } from "node:crypto";

/** Generate a collision-resistant idempotency key for one logical write. */
export function generateIdempotencyKey(generate = randomUUID) {
  const value = generate();
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("idempotency key generator must return a non-empty string");
  }
  return value.trim();
}
