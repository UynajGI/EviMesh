import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { homedir, hostname, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { encodeEd25519DidKey } from "../../signatures/src/did-key.mjs";
import { configDir, loadConfig, saveConfig } from "./config.mjs";

const VAULT_SCHEMA = "evimesh.local-signing-key-vault.v1";
const PUBLIC_KEY_SCHEMA = "evimesh.signing-public-key.v1";
const CIPHER = "aes-256-gcm";
const AUTH_TAG_BYTES = 16;
const DEFAULT_KDF = Object.freeze({ N: 131_072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
const DEFAULT_LOCK = Object.freeze({ timeoutMs: 15_000, retryMs: 25, staleMs: 30_000 });
const LOCK_FILE = "signing-keys.lock";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const ED25519_SPKI_BYTES = 44;

export class CliIdentityError extends Error {
  constructor(message, code = "CLI_IDENTITY_INVALID") {
    super(message);
    this.name = "CliIdentityError";
    this.code = code;
  }
}

function vaultPath(env) {
  return join(configDir(env), "signing-keys.json");
}

function lockPath(env) {
  return join(configDir(env), LOCK_FILE);
}

function purgeLegacyPlaintextIdentity(env) {
  if (loadConfig(env)?.identity !== undefined) saveConfig({ identity: undefined }, env);
}

function legacyPlaintextIdentity(env) {
  return loadConfig(env)?.identity ?? null;
}

function refuseUnmigratedLegacyIdentity(env) {
  if (legacyPlaintextIdentity(env)) {
    throw new CliIdentityError("a legacy plaintext signing key must be migrated interactively with `sq key create`", "CLI_LEGACY_KEY_MIGRATION_REQUIRED");
  }
}

function secureDirectory(env) {
  const dir = configDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* Mode bits are not a portable Windows ACL mechanism. */ }
  return dir;
}

function pathWithin(base, target) {
  const rel = relative(resolve(base), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Return actionable path-security warnings without inspecting or exposing key material. */
export function localKeySecurityWarnings(env = process.env) {
  const dir = resolve(configDir(env));
  const warnings = [];
  if (process.platform === "win32") {
    warnings.push(`Node cannot verify Windows ACL inheritance or guarantee directory fsync for ${dir}. Confirm access with: icacls "${dir}" and keep an encrypted backup.`);
    const obviousSharedRoots = [tmpdir(), env.PUBLIC, env.ProgramData, env.SystemRoot].filter(Boolean);
    if (dir.startsWith("\\\\") || obviousSharedRoots.some((root) => pathWithin(root, dir))) {
      warnings.push(`Signing keys are under a shared or temporary Windows path (${dir}). Move EVIMESH_CONFIG_DIR under your user profile and verify access with: icacls "${dir}"`);
    } else if (!pathWithin(homedir(), dir)) {
      warnings.push(`Signing keys are outside your Windows user profile (${dir}). Verify that only your account has access with: icacls "${dir}"`);
    }
  } else {
    for (const path of [dir, vaultPath(env)]) {
      if (!existsSync(path)) continue;
      try {
        if ((statSync(path).mode & 0o077) !== 0) warnings.push(`Signing-key path permits group or world access: ${path}. Run: chmod ${path === dir ? "700" : "600"} "${path}"`);
      } catch { warnings.push(`Could not verify signing-key permissions for ${path}. Check ownership and mode before signing.`); }
    }
  }
  try {
    const compromised = readVault(env).keys.filter((entry) => entry.state === "compromised");
    if (compromised.length > 0) {
      warnings.push(`Legacy plaintext key${compromised.length === 1 ? "" : "s"} ${compromised.map((entry) => entry.keyId).join(", ")} must be revoked in EviMesh. Old config files, backups, and disk blocks may still contain the exposed private material.`);
    }
  } catch { /* Vault read errors are reported by the command that requested it. */ }
  return Object.freeze(warnings);
}

function emptyVault() {
  return { schema: VAULT_SCHEMA, generation: 0, keys: [] };
}

function readVault(env = process.env) {
  const path = vaultPath(env);
  if (!existsSync(path)) return emptyVault();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new CliIdentityError("local signing-key vault is unreadable", "CLI_KEY_VAULT_UNREADABLE");
  }
  if (parsed?.schema !== VAULT_SCHEMA || !Array.isArray(parsed.keys)
    || (parsed.generation !== undefined && (!Number.isSafeInteger(parsed.generation) || parsed.generation < 0))) {
    throw new CliIdentityError("local signing-key vault schema is not supported", "CLI_KEY_VAULT_SCHEMA");
  }
  return { ...parsed, generation: parsed.generation ?? 0 };
}

function syncDirectory(path) {
  let fd;
  try {
    fd = openSync(path, "r");
    fsyncSync(fd);
    return true;
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "EINVAL", "ENOTSUP"].includes(error?.code)) return false;
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function writeDurableFile(path, value, { mode = 0o600, flag = "wx" } = {}) {
  let fd;
  try {
    fd = openSync(path, flag, mode);
    writeFileSync(fd, value, "utf8");
    fsyncSync(fd);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function writeVault(vault, env = process.env, expectedGeneration) {
  const dir = secureDirectory(env);
  const path = vaultPath(env);
  const temporary = join(dir, `.signing-keys.${process.pid}.${randomUUID()}.tmp`);
  const current = readVault(env);
  if (!Number.isSafeInteger(expectedGeneration) || current.generation !== expectedGeneration) {
    throw new CliIdentityError("local signing-key vault changed concurrently", "CLI_KEY_VAULT_CONFLICT");
  }
  const next = { ...vault, schema: VAULT_SCHEMA, generation: expectedGeneration + 1 };
  try {
    writeDurableFile(temporary, `${JSON.stringify(next, null, 2)}\n`);
    try { chmodSync(temporary, 0o600); } catch { /* Mode bits are best-effort on Windows. */ }
    renameSync(temporary, path);
    try { chmodSync(path, 0o600); } catch { /* Mode bits are best-effort on Windows. */ }
    syncDirectory(dir);
  } catch {
    throw new CliIdentityError("could not persist the encrypted signing-key vault", "CLI_KEY_VAULT_WRITE");
  } finally {
    if (existsSync(temporary)) {
      try { rmSync(temporary, { force: true }); } catch { /* A stale encrypted temp remains mode-restricted and contains no plaintext. */ }
    }
  }
  return next;
}

function normalizeLockOptions(options = DEFAULT_LOCK) {
  const normalized = {
    timeoutMs: Number(options.timeoutMs ?? DEFAULT_LOCK.timeoutMs),
    retryMs: Number(options.retryMs ?? DEFAULT_LOCK.retryMs),
    staleMs: Number(options.staleMs ?? DEFAULT_LOCK.staleMs),
  };
  if (!Number.isInteger(normalized.timeoutMs) || normalized.timeoutMs < 100
    || !Number.isInteger(normalized.retryMs) || normalized.retryMs < 1 || normalized.retryMs > 1_000
    || !Number.isInteger(normalized.staleMs) || normalized.staleMs < 100) {
    throw new CliIdentityError("signing-key lock options are invalid", "CLI_KEY_LOCK_INVALID");
  }
  return normalized;
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function readLockOwner(path) {
  try {
    const owner = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
    return owner && typeof owner === "object" ? owner : null;
  } catch { return null; }
}

function lockIsStale(path, options, now = Date.now()) {
  let modifiedAt = now;
  try { modifiedAt = statSync(path).mtimeMs; } catch { return false; }
  const owner = readLockOwner(path);
  const createdAt = Number.isFinite(Date.parse(owner?.createdAt)) ? Date.parse(owner.createdAt) : modifiedAt;
  if (owner?.host === hostname() && Number.isInteger(owner?.pid)) return !processIsRunning(owner.pid);
  return now - createdAt >= options.staleMs;
}

function recoverStaleLock(path, options) {
  if (!lockIsStale(path, options)) return false;
  const quarantine = `${path}.stale.${process.pid}.${randomUUID()}`;
  try {
    renameSync(path, quarantine);
  } catch { return false; }
  try { rmSync(quarantine, { recursive: true, force: true }); } finally {
    try { syncDirectory(resolve(path, "..")); } catch { /* Recovery remains visible through the subsequent lock attempt. */ }
  }
  return true;
}

function acquireVaultLock(env, lockOptions = DEFAULT_LOCK) {
  const options = normalizeLockOptions(lockOptions);
  const dir = secureDirectory(env);
  const path = lockPath(env);
  const token = randomUUID();
  const deadline = Date.now() + options.timeoutMs;
  while (Date.now() <= deadline) {
    try {
      mkdirSync(path, { mode: 0o700 });
      const owner = { token, pid: process.pid, host: hostname(), createdAt: new Date().toISOString() };
      writeDurableFile(join(path, "owner.json"), `${JSON.stringify(owner)}\n`);
      syncDirectory(path);
      syncDirectory(dir);
      return () => {
        const current = readLockOwner(path);
        if (current?.token !== token) return;
        try { rmSync(path, { recursive: true, force: true }); } catch { return; }
        try { syncDirectory(dir); } catch { /* A crashed-release lock is recoverable through stale-owner handling. */ }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        try { rmSync(path, { recursive: true, force: true }); } catch { /* Failed acquisition left nothing trustworthy to preserve. */ }
        throw new CliIdentityError("could not acquire the local signing-key vault lock", "CLI_KEY_LOCK_FAILED");
      }
      if (recoverStaleLock(path, options)) continue;
      sleepSync(options.retryMs);
    }
  }
  throw new CliIdentityError("timed out waiting for the local signing-key vault lock", "CLI_KEY_LOCK_TIMEOUT");
}

function withVaultLock(env, lockOptions, callback) {
  const release = acquireVaultLock(env, lockOptions);
  try { return callback(); } finally { release(); }
}

function requirePassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 12) {
    throw new CliIdentityError("signing-key passphrase must contain at least 12 characters", "CLI_KEY_PASSPHRASE_WEAK");
  }
  return passphrase;
}

function normalizeKdf(kdf = DEFAULT_KDF) {
  const normalized = { N: Number(kdf.N), r: Number(kdf.r), p: Number(kdf.p), maxmem: Number(kdf.maxmem) };
  if (!Number.isInteger(normalized.N) || normalized.N < 2 || normalized.N > 1_048_576 || (normalized.N & (normalized.N - 1)) !== 0
    || !Number.isInteger(normalized.r) || normalized.r < 1 || normalized.r > 32
    || !Number.isInteger(normalized.p) || normalized.p < 1 || normalized.p > 16
    || !Number.isInteger(normalized.maxmem) || normalized.maxmem < 32 * 1024 * 1024 || normalized.maxmem > 1024 * 1024 * 1024) {
    throw new CliIdentityError("signing-key KDF parameters are invalid", "CLI_KEY_KDF_INVALID");
  }
  return normalized;
}

function decodeCanonicalPublicKey(publicKey) {
  if (typeof publicKey !== "string" || publicKey.length === 0 || publicKey.includes("=")
    || !/^[A-Za-z0-9_-]+$/.test(publicKey)) {
    throw new CliIdentityError("Ed25519 public key is not canonical base64url", "CLI_KEY_PUBLIC_INVALID");
  }
  const decoded = Buffer.from(publicKey, "base64url");
  if (decoded.toString("base64url") !== publicKey || decoded.length !== ED25519_SPKI_BYTES
    || !decoded.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    throw new CliIdentityError("Ed25519 public key must be the canonical 44-byte SPKI DER form", "CLI_KEY_PUBLIC_INVALID");
  }
  return decoded;
}

function publicFingerprint(publicKey) {
  const decoded = decodeCanonicalPublicKey(publicKey);
  return `sha256:${createHash("sha256").update(decoded).digest("hex")}`;
}

function encryptionAad(record) {
  return Buffer.from(JSON.stringify({
    schema: VAULT_SCHEMA,
    keyId: record.keyId,
    algorithm: record.algorithm,
    publicKey: record.publicKey,
    fingerprint: record.fingerprint,
    did: record.did,
    label: record.label,
    createdAt: record.createdAt,
  }), "utf8");
}

function encryptPrivateKey(privateKey, passphrase, record, kdfParams = DEFAULT_KDF) {
  const kdf = normalizeKdf(kdfParams);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derived = scryptSync(requirePassphrase(passphrase), salt, 32, kdf);
  try {
    const cipher = createCipheriv(CIPHER, derived, iv, { authTagLength: AUTH_TAG_BYTES });
    cipher.setAAD(encryptionAad(record));
    const ciphertext = Buffer.concat([cipher.update(privateKey), cipher.final()]);
    return {
      kdf: "scrypt", N: kdf.N, r: kdf.r, p: kdf.p, maxmem: kdf.maxmem,
      salt: salt.toString("base64url"), cipher: CIPHER, iv: iv.toString("base64url"),
      authTag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url"),
    };
  } finally {
    derived.fill(0);
  }
}

function decryptPrivateKey(record, passphrase) {
  const encrypted = record?.encryptedPrivateKey;
  if (!encrypted || encrypted.kdf !== "scrypt" || encrypted.cipher !== CIPHER) {
    throw new CliIdentityError("local signing key is not available", "CLI_KEY_NOT_AVAILABLE");
  }
  const kdf = normalizeKdf(encrypted);
  let derived;
  let updatePlaintext;
  let finalPlaintext;
  try {
    derived = scryptSync(requirePassphrase(passphrase), Buffer.from(encrypted.salt, "base64url"), 32, kdf);
    const decipher = createDecipheriv(CIPHER, derived, Buffer.from(encrypted.iv, "base64url"), { authTagLength: AUTH_TAG_BYTES });
    decipher.setAAD(encryptionAad(record));
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64url"));
    // AES-GCM authenticates at final(). update() can therefore return the
    // entire plaintext before an invalid tag is detected. Keep both chunks
    // explicit so every temporary copy is overwritten on success and failure.
    updatePlaintext = decipher.update(Buffer.from(encrypted.ciphertext, "base64url"));
    finalPlaintext = decipher.final();
    const privateKey = Buffer.concat([updatePlaintext, finalPlaintext]);
    updatePlaintext.fill(0);
    finalPlaintext.fill(0);
    updatePlaintext = undefined;
    finalPlaintext = undefined;
    return privateKey;
  } catch {
    throw new CliIdentityError("could not unlock signing key; the passphrase is wrong or the vault is corrupt", "CLI_KEY_UNLOCK_FAILED");
  } finally {
    updatePlaintext?.fill(0);
    finalPlaintext?.fill(0);
    derived?.fill(0);
  }
}

function publicRecord(record) {
  if (record?.algorithm !== "Ed25519") {
    throw new CliIdentityError("local signing key algorithm is not supported", "CLI_KEY_PUBLIC_INVALID");
  }
  const expectedFingerprint = publicFingerprint(record.publicKey);
  if (record.fingerprint !== expectedFingerprint) {
    throw new CliIdentityError("local signing-key fingerprint does not match its public key", "CLI_KEY_PUBLIC_INVALID");
  }
  return Object.freeze({
    schema: PUBLIC_KEY_SCHEMA,
    keyId: record.keyId,
    label: record.label,
    algorithm: record.algorithm,
    publicKey: record.publicKey,
    fingerprint: record.fingerprint,
    did: record.did,
    createdAt: record.createdAt,
    state: record.state,
    localDisabledAt: record.localDisabledAt ?? record.revokedAt ?? null,
  });
}

/** Create an Ed25519 key and persist only authenticated ciphertext plus public metadata. */
export function createLocalIdentity({ env = process.env, passphrase, label = "Primary signing key", now = new Date(), kdfParams = DEFAULT_KDF, lockOptions = DEFAULT_LOCK } = {}) {
  requirePassphrase(passphrase);
  const legacy = legacyPlaintextIdentity(env);
  let compromisedLegacyRecord = null;
  if (legacy) {
    let legacyPrivateDer;
    let legacyPublicDer;
    let derivedPublic;
    try {
      if (legacy.algorithm !== "Ed25519" || typeof legacy.privateKey !== "string" || typeof legacy.publicKey !== "string") throw new Error("invalid legacy key");
      legacyPrivateDer = Buffer.from(legacy.privateKey, "base64url");
      legacyPublicDer = Buffer.from(legacy.publicKey, "base64url");
      const privateObject = createPrivateKey({ key: legacyPrivateDer, format: "der", type: "pkcs8" });
      derivedPublic = Buffer.from(createPublicKey(privateObject).export({ format: "der", type: "spki" }));
      if (derivedPublic.length !== legacyPublicDer.length || !timingSafeEqual(derivedPublic, legacyPublicDer)) throw new Error("legacy public key mismatch");
      const encodedPublic = legacyPublicDer.toString("base64url");
      compromisedLegacyRecord = {
        keyId: typeof legacy.keyId === "string" && legacy.keyId.trim() ? legacy.keyId.trim() : `key_legacy_${publicFingerprint(encodedPublic).slice(-16)}`,
        label: "Legacy plaintext key — compromised",
        algorithm: "Ed25519",
        publicKey: encodedPublic,
        fingerprint: publicFingerprint(encodedPublic),
        did: encodeEd25519DidKey(legacyPublicDer),
        createdAt: typeof legacy.createdAt === "string" && !Number.isNaN(Date.parse(legacy.createdAt)) ? legacy.createdAt : now.toISOString(),
        state: "compromised",
        localDisabledAt: now.toISOString(),
        compromiseReason: "legacy_plaintext_exposure",
      };
    } catch {
      throw new CliIdentityError("legacy plaintext signing key is invalid and could not be migrated", "CLI_LEGACY_KEY_INVALID");
    } finally {
      legacyPrivateDer?.fill(0);
      legacyPublicDer?.fill(0);
      derivedPublic?.fill(0);
    }
  }
  // A key that ever existed in plaintext cannot be made secret again by
  // encrypting the same bytes. Always rotate to a fresh pair and retain only
  // the old public metadata so the user can revoke it server-side.
  const generated = generateKeyPairSync("ed25519");
  const publicDer = Buffer.from(generated.publicKey.export({ format: "der", type: "spki" }));
  const privateDer = Buffer.from(generated.privateKey.export({ format: "der", type: "pkcs8" }));
  try {
    const encodedPublic = publicDer.toString("base64url");
    const record = {
      keyId: `key_${randomUUID()}`,
      label: typeof label === "string" && label.trim() ? label.trim() : "Primary signing key",
      algorithm: "Ed25519",
      publicKey: encodedPublic,
      fingerprint: publicFingerprint(encodedPublic),
      did: encodeEd25519DidKey(publicDer),
      createdAt: now.toISOString(),
      state: "active",
      localDisabledAt: null,
    };
    record.encryptedPrivateKey = encryptPrivateKey(privateDer, passphrase, record, kdfParams);
    return withVaultLock(env, lockOptions, () => {
      const currentLegacy = legacyPlaintextIdentity(env);
      const vault = readVault(env);
      if (legacy && vault.keys.length > 0) {
        throw new CliIdentityError("legacy plaintext key conflicts with the encrypted vault; resolve it before creating another key", "CLI_LEGACY_KEY_CONFLICT");
      }
      if ((legacy?.privateKey ?? null) !== (currentLegacy?.privateKey ?? null)) {
        throw new CliIdentityError("legacy plaintext key changed during migration", "CLI_KEY_VAULT_CONFLICT");
      }
      if (compromisedLegacyRecord) vault.keys.push(compromisedLegacyRecord);
      vault.keys.push(record);
      writeVault(vault, env, vault.generation);
      if (legacy) purgeLegacyPlaintextIdentity(env);
      const created = publicRecord(record);
      return compromisedLegacyRecord
        ? Object.freeze({ ...created, compromisedLegacyKey: publicRecord(compromisedLegacyRecord) })
        : created;
    });
  } finally {
    privateDer.fill(0);
    publicDer.fill(0);
  }
}

export function listLocalIdentities(env = process.env) {
  refuseUnmigratedLegacyIdentity(env);
  return Object.freeze(readVault(env).keys.map(publicRecord));
}

export function exportLocalPublicKey(keyId, env = process.env) {
  refuseUnmigratedLegacyIdentity(env);
  const keys = readVault(env).keys;
  const active = keys.filter((entry) => entry.state === "active");
  const record = keyId ? keys.find((entry) => entry.keyId === keyId) : active.length === 1 ? active[0] : null;
  if (!record) throw new CliIdentityError(keyId ? "local signing key was not found" : "select a signing key with --key", "CLI_KEY_NOT_FOUND");
  return publicRecord(record);
}

/** Decrypt one active private key for a single operation. The caller should best-effort overwrite the returned JS Buffer. */
export function unlockLocalIdentity({ keyId = null, passphrase, env = process.env } = {}) {
  refuseUnmigratedLegacyIdentity(env);
  const active = readVault(env).keys.filter((entry) => entry.state === "active");
  const record = keyId ? active.find((entry) => entry.keyId === keyId) : active.length === 1 ? active[0] : null;
  if (!record) throw new CliIdentityError(keyId ? "active local signing key was not found" : "select an active signing key with --key", "CLI_KEY_NOT_FOUND");
  return Object.freeze({ public: publicRecord(record), privateKey: decryptPrivateKey(record, passphrase) });
}

/** Disable this local copy; server-side public-key revocation is a separate authoritative action. */
export function revokeLocalIdentity({ keyId, env = process.env, now = new Date(), lockOptions = DEFAULT_LOCK } = {}) {
  refuseUnmigratedLegacyIdentity(env);
  if (typeof keyId !== "string" || !keyId.trim()) throw new CliIdentityError("key id is required", "CLI_KEY_NOT_FOUND");
  return withVaultLock(env, lockOptions, () => {
    const vault = readVault(env);
    const record = vault.keys.find((entry) => entry.keyId === keyId.trim() && entry.state === "active");
    if (!record) throw new CliIdentityError("active local signing key was not found", "CLI_KEY_NOT_FOUND");
    delete record.encryptedPrivateKey;
    record.state = "disabled-local";
    record.localDisabledAt = now.toISOString();
    delete record.revokedAt;
    writeVault(vault, env, vault.generation);
    return publicRecord(record);
  });
}

export const LOCAL_KEY_VAULT_SCHEMA = VAULT_SCHEMA;
