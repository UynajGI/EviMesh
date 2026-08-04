import { randomBytes } from "node:crypto";
import { formatObjectId, OBJECT_ID_PREFIXES } from "./object-id.mjs";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TIMESTAMP = 0xffffffffffff;

function assertTimestamp(timestamp) {
  if (!Number.isInteger(timestamp) || timestamp < 0 || timestamp > MAX_TIMESTAMP) {
    throw new RangeError("UUIDv7 timestamp must be an integer in the 48-bit Unix millisecond range");
  }
}

function assertRandomBytes(bytes) {
  if (!bytes || typeof bytes.length !== "number" || bytes.length !== 16) {
    throw new TypeError("UUIDv7 randomness must contain exactly 16 bytes");
  }
}

function bytesToUuid(bytes) {
  const hex = Buffer.from(bytes).toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

export function createUuidV7(timestamp = Date.now(), bytes = randomBytes(16)) {
  assertTimestamp(timestamp);
  assertRandomBytes(bytes);

  const value = Buffer.from(bytes);
  for (let index = 5; index >= 0; index -= 1) {
    value[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }

  value[6] = (value[6] & 0x0f) | 0x70;
  value[8] = (value[8] & 0x3f) | 0x80;
  return bytesToUuid(value);
}

export function isUuidV7(value) {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

export function uuidV7Timestamp(value) {
  if (!isUuidV7(value)) {
    throw new TypeError("Value must be a canonical UUIDv7");
  }

  return Number.parseInt(value.replaceAll("-", "").slice(0, 12), 16);
}

export function createObjectId(kind, timestamp = Date.now(), bytes = randomBytes(16)) {
  if (!Object.hasOwn(OBJECT_ID_PREFIXES, kind)) {
    throw new TypeError(`Unsupported object kind: ${kind}`);
  }

  return formatObjectId(kind, createUuidV7(timestamp, bytes));
}
