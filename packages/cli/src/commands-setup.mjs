import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEFAULT_API_URL, DEFAULT_CLIENT_ID, saveConfig, createFileStorage, loadConfig } from "./config.mjs";
import { createLocalIdentity, exportLocalPublicKey, listLocalIdentities, localKeySecurityWarnings, revokeLocalIdentity } from "./identity.mjs";
import { saveLimitedToken, startDeviceLogin, pollDeviceLogin } from "./auth.mjs";
import { flagString, flagBool, requirePositional } from "./args.mjs";
import { rejectSigningBypassFlags, requireHumanInteraction } from "./human-interaction.mjs";
import { requirePublicCapability } from "./capabilities.mjs";

function warningLines(warnings) {
  return warnings.length > 0 ? `\nwarning: ${warnings.join("\nwarning: ")}` : "";
}

export async function configInit({ flags, output, env = process.env }) {
  const apiUrl = flagString(flags, "api-url", DEFAULT_API_URL);
  const clientId = flagString(flags, "client-id", DEFAULT_CLIENT_ID);
  const existing = loadConfig(env);
  const config = saveConfig({ apiUrl, clientId, createdAt: existing?.createdAt ?? new Date().toISOString() }, env);
  output.emit({ json: flagBool(flags, "json") }, { status: "initialized", apiUrl: config.apiUrl, clientId: config.clientId }, (data) =>
    data.status === "initialized" ? `configuration initialized (apiUrl=${data.apiUrl}, clientId=${data.clientId})` : "");
  return 0;
}

export async function authLogin({ flags, output, env = process.env, fetchImpl } = {}) {
  const json = flagBool(flags, "json");
  const config = loadConfig(env);
  if (!config) throw new Error("no configuration found; run `sq config init` first");
  const explicitToken = flagString(flags, "token", null);
  if (explicitToken) {
    const scopes = flagString(flags, "scopes", "profile:read,project:read").split(",").map((scope) => scope.trim()).filter(Boolean);
    saveLimitedToken(createFileStorage(env), { access_token: explicitToken, scopes });
    output.emit({ json }, { status: "token_saved", scopes }, (data) => `token saved with scopes: ${data.scopes.join(", ")}`);
    return 0;
  }
  const apiBaseUrl = flagString(flags, "api-url", config.apiUrl ?? DEFAULT_API_URL);
  const clientId = flagString(flags, "client-id", config.clientId ?? DEFAULT_CLIENT_ID);
  await requirePublicCapability({ capability: "deviceAuthorization", command: "sq auth login", flags, env, fetchImpl });
  const options = { apiBaseUrl, clientId };
  if (fetchImpl) options.fetchImpl = fetchImpl;
  const device = await startDeviceLogin(options);
  if (!json) {
    process.stderr.write(`Open ${apiBaseUrl}/device and enter code: ${device.user_code}\nWaiting for authorization…\n`);
  }
  const pollOptions = { apiBaseUrl, deviceCode: device.device_code, interval: device.interval ?? 5, maxAttempts: Number(flagString(flags, "max-attempts", "60")) };
  if (fetchImpl) pollOptions.fetchImpl = fetchImpl;
  const token = await pollDeviceLogin(pollOptions);
  saveLimitedToken(createFileStorage(env), token);
  output.emit({ json }, { status: "logged_in", scopes: token.scopes }, (data) => `logged in with scopes: ${data.scopes.join(", ")}`);
  return 0;
}

export async function keyCreate({ flags, output, env = process.env, testInteraction = null, testKeyStoreOptions = {} } = {}) {
  rejectSigningBypassFlags(flags);
  const json = flagBool(flags, "json");
  const interaction = requireHumanInteraction(testInteraction);
  const passphrase = await interaction.secret("New signing-key passphrase: ");
  const repeated = await interaction.secret("Repeat signing-key passphrase: ");
  if (passphrase !== repeated) {
    const error = new Error("signing-key passphrases do not match");
    error.code = "CLI_KEY_PASSPHRASE_MISMATCH";
    throw error;
  }
  const key = createLocalIdentity({
    env,
    passphrase,
    label: flagString(flags, "label", "Primary signing key"),
    kdfParams: testKeyStoreOptions.kdfParams,
    lockOptions: testKeyStoreOptions.lockOptions,
  });
  const warnings = localKeySecurityWarnings(env);
  output.emit({ json }, { key, registered: false, warnings }, (data) =>
    `created encrypted ${data.key.algorithm} key ${data.key.keyId}\nfingerprint: ${data.key.fingerprint}\nregister the exported public key in EviMesh before signing submissions${warningLines(data.warnings)}`);
  return 0;
}

/** Compatibility alias; unlike the legacy command this never persists or sends plaintext key material. */
export async function identityGenerate(options = {}) {
  return keyCreate(options);
}

export async function keyList({ flags, output, env = process.env } = {}) {
  const keys = listLocalIdentities(env);
  const warnings = localKeySecurityWarnings(env);
  output.emit({ json: flagBool(flags, "json") }, { keys, warnings }, (data) => `${data.keys.length === 0
    ? "no local signing keys"
    : data.keys.map((key) => `${key.keyId}  ${key.state}  ${key.fingerprint}  ${key.label}`).join("\n")}${warningLines(data.warnings)}`);
  return 0;
}

export async function keyExportPublic({ flags, output, env = process.env, positionals = [] } = {}) {
  const keyId = flagString(flags, "key", positionals[0] ?? null);
  const key = exportLocalPublicKey(keyId, env);
  const outFlag = flagString(flags, "out", null);
  let out = null;
  if (outFlag) {
    out = resolve(outFlag);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(key, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
  const warnings = localKeySecurityWarnings(env);
  output.emit({ json: flagBool(flags, "json") }, { key, out, warnings }, (data) => `${data.out
    ? `public key written to ${data.out}`
    : JSON.stringify(data.key, null, 2)}${warningLines(data.warnings)}`);
  return 0;
}

export async function keyRevokeLocal({ flags, output, env = process.env, positionals = [], testInteraction = null, testKeyStoreOptions = {} } = {}) {
  rejectSigningBypassFlags(flags);
  const keyId = flagString(flags, "key", null) ?? requirePositional(positionals, 0, "key-id");
  const key = exportLocalPublicKey(keyId, env);
  if (key.state !== "active") {
    const error = new Error("local signing key is not active");
    error.code = "CLI_KEY_NOT_ACTIVE";
    throw error;
  }
  const interaction = requireHumanInteraction(testInteraction);
  const authorized = await interaction.authorize({
    phrase: "REMOVE",
    prompt: `Remove this machine's encrypted copy for ${key.keyId} (${key.fingerprint})? Backups may restore it; the registered server key remains active until separately revoked in account settings.`,
  });
  if (!authorized) {
    const error = new Error("local key removal was cancelled");
    error.code = "CLI_HUMAN_CANCELLED";
    throw error;
  }
  const disabled = revokeLocalIdentity({ keyId, env, lockOptions: testKeyStoreOptions.lockOptions });
  const warnings = localKeySecurityWarnings(env);
  output.emit({ json: flagBool(flags, "json") }, { key: disabled, warnings }, (data) => `removed this machine's encrypted copy for ${data.key.keyId}; revoke the registered public key separately in EviMesh account settings${warningLines(data.warnings)}`);
  return 0;
}
