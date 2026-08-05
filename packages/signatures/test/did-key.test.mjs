import test from "node:test";
import assert from "node:assert/strict";
import { generateEd25519KeyPair } from "../src/ed25519.mjs";
import { decodeEd25519DidKey, encodeEd25519DidKey } from "../src/did-key.mjs";

test("round-trips an Ed25519 SPKI public key through did:key", () => {
  const keyPair = generateEd25519KeyPair();
  const didKey = encodeEd25519DidKey(keyPair.public_key);

  assert.match(didKey, /^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
  assert.equal(decodeEd25519DidKey(didKey), keyPair.public_key);
});

test("rejects non-Ed25519 did:key values", () => {
  assert.throws(() => decodeEd25519DidKey("did:key:z123"), /not an Ed25519 key/);
  assert.throws(() => decodeEd25519DidKey("did:key:uabc"), /base58btc/);
});
