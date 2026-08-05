function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** Verify a client signature over protocol signing_bytes. */
export async function verifyEd25519Payload({ signingBytes, signature, publicKey } = {}) {
  if (!(signingBytes instanceof Uint8Array)) {
    throw new TypeError("signingBytes must be a Uint8Array");
  }
  if (typeof signature !== "string" || signature.length === 0) {
    throw new TypeError("signature must be a base64url string");
  }
  if (typeof publicKey !== "string" || publicKey.length === 0) {
    throw new TypeError("publicKey must be a base64url SPKI key");
  }

  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "spki",
      decodeBase64Url(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      cryptoKey,
      decodeBase64Url(signature),
      signingBytes,
    );
  } catch {
    return false;
  }
}
