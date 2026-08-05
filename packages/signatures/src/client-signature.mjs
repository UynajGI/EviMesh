function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

/**
 * Sign the canonical signing_bytes produced by the protocol envelope.
 * The caller must keep the PKCS#8 private key protected on the client.
 */
export async function signEd25519Payload({ signingBytes, privateKey } = {}) {
  if (!(signingBytes instanceof Uint8Array)) {
    throw new TypeError("signingBytes must be a Uint8Array");
  }
  if (typeof privateKey !== "string" || privateKey.length === 0) {
    throw new TypeError("privateKey must be a base64url PKCS#8 key");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64Url(privateKey),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("Ed25519", cryptoKey, signingBytes);
  return encodeBase64Url(signature);
}
