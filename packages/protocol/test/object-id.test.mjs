import test from "node:test";
import assert from "node:assert/strict";
import {
  OBJECT_ID_PREFIXES,
  formatObjectId,
  isObjectId,
  parseObjectId,
} from "../src/object-id.mjs";
import {
  createObjectId,
  createUuidV7,
  isUuidV7,
  uuidV7Timestamp,
} from "../src/uuidv7.mjs";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

test("formats every M1 object kind with its stable prefix", () => {
  for (const [kind, prefix] of Object.entries(OBJECT_ID_PREFIXES)) {
    assert.equal(formatObjectId(kind, UUID), `${prefix}_${UUID}`);
  }
});

test("parses an object ID and normalizes UUID casing", () => {
  assert.deepEqual(parseObjectId(`claim_${UUID.toUpperCase()}`), {
    kind: "Claim",
    prefix: "claim",
    uuid: UUID,
  });
});

test("rejects unsupported prefixes and malformed UUIDs", () => {
  assert.equal(isObjectId("claim_not-a-uuid"), false);
  assert.equal(isObjectId(`${UUID}`), false);
  assert.throws(() => parseObjectId("sample_550e8400-e29b-41d4-a716-446655440000"));
  assert.throws(() => formatObjectId("Unknown", UUID));
});

test("creates a UUIDv7 with the supplied millisecond timestamp", () => {
  const timestamp = 0x018f12345678;
  const uuid = createUuidV7(timestamp, Buffer.alloc(16));

  assert.equal(isUuidV7(uuid), true);
  assert.equal(uuidV7Timestamp(uuid), timestamp);
  assert.equal(uuid[14], "7");
  assert.match(uuid[19], /[89ab]/);
});

test("creates a typed object ID without changing the UUID format", () => {
  const id = createObjectId("Claim", 1, Buffer.alloc(16, 0xff));

  assert.equal(id, "claim_00000000-0001-7fff-bfff-ffffffffffff");
  assert.deepEqual(parseObjectId(id), {
    kind: "Claim",
    prefix: "claim",
    uuid: "00000000-0001-7fff-bfff-ffffffffffff",
  });
});

test("rejects timestamps outside the UUIDv7 48-bit range", () => {
  assert.throws(() => createUuidV7(-1, Buffer.alloc(16)), RangeError);
  assert.throws(() => createUuidV7(0x1000000000000, Buffer.alloc(16)), RangeError);
});
