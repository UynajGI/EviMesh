import { randomUUID } from "node:crypto";
import { generateEd25519KeyPair } from "../../signatures/src/ed25519.mjs";
import { encodeEd25519DidKey } from "../../signatures/src/did-key.mjs";
import { loadConfig, saveConfig } from "./config.mjs";

export class CliIdentityError extends Error {
  constructor(message, code = "CLI_IDENTITY_INVALID") {
    super(message);
    this.name = "CliIdentityError";
    this.code = code;
  }
}

/** Generate a new Ed25519 signing identity and persist it in the CLI config. */
export function generateIdentity(env = process.env) {
  const keypair = generateEd25519KeyPair();
  const identity = {
    keyId: `key_${randomUUID()}`,
    algorithm: keypair.algorithm,
    publicKey: keypair.public_key,
    privateKey: keypair.private_key,
    did: encodeEd25519DidKey(Buffer.from(keypair.public_key, "base64url")),
    createdAt: new Date().toISOString(),
  };
  saveConfig({ identity }, env);
  return identity;
}

export function loadIdentity(env = process.env) {
  const identity = loadConfig(env)?.identity;
  if (!identity || typeof identity.privateKey !== "string" || typeof identity.publicKey !== "string") {
    throw new CliIdentityError("no signing identity configured; run `sq identity generate`", "CLI_IDENTITY_MISSING");
  }
  return identity;
}
