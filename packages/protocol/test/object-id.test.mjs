import test from "node:test";
import assert from "node:assert/strict";
import {
  OBJECT_ID_PREFIXES,
  formatObjectId,
  isObjectId,
  parseObjectId,
} from "../src/object-id.mjs";

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
