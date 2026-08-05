const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));
const ED25519_MULTICODEC = Uint8Array.from([0xed, 0x01]);
const ED25519_SPKI_PREFIX = Uint8Array.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function base58Encode(bytes) {
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let output = "";
  while (value > 0n) {
    output = BASE58_ALPHABET[Number(value % 58n)] + output;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    output = `1${output}`;
  }
  return output || "1";
}

function base58Decode(value) {
  if (!value) throw new TypeError("base58 value is required");
  let number = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) throw new TypeError("invalid base58 character");
    number = number * 58n + BigInt(digit);
  }
  const bytes = [];
  while (number > 0n) {
    bytes.unshift(Number(number % 256n));
    number /= 256n;
  }
  for (const character of value) {
    if (character !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

function extractRawPublicKey(publicKeyDer) {
  const der = typeof publicKeyDer === "string" ? decodeBase64Url(publicKeyDer) : publicKeyDer;
  if (!(der instanceof Uint8Array) || der.length !== ED25519_SPKI_PREFIX.length + 32
    || !ED25519_SPKI_PREFIX.every((byte, index) => der[index] === byte)) {
    throw new TypeError("public key must be an Ed25519 SPKI DER key");
  }
  return der.slice(ED25519_SPKI_PREFIX.length);
}

/** Encode an M4-09 SPKI public key as a did:key identifier. */
export function encodeEd25519DidKey(publicKeyDer) {
  const rawPublicKey = extractRawPublicKey(publicKeyDer);
  const fingerprint = new Uint8Array(ED25519_MULTICODEC.length + rawPublicKey.length);
  fingerprint.set(ED25519_MULTICODEC);
  fingerprint.set(rawPublicKey, ED25519_MULTICODEC.length);
  return `did:key:z${base58Encode(fingerprint)}`;
}

/** Decode a did:key identifier back to the M4-09 SPKI public-key encoding. */
export function decodeEd25519DidKey(value) {
  if (typeof value !== "string" || !value.startsWith("did:key:z")) {
    throw new TypeError("did:key must use the base58btc multibase prefix");
  }
  const fingerprint = base58Decode(value.slice("did:key:z".length));
  if (fingerprint.length !== ED25519_MULTICODEC.length + 32
    || !ED25519_MULTICODEC.every((byte, index) => fingerprint[index] === byte)) {
    throw new TypeError("did:key is not an Ed25519 key");
  }
  const der = new Uint8Array(ED25519_SPKI_PREFIX.length + 32);
  der.set(ED25519_SPKI_PREFIX);
  der.set(fingerprint.slice(ED25519_MULTICODEC.length), ED25519_SPKI_PREFIX.length);
  return encodeBase64Url(der);
}
