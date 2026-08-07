import { DEFAULT_API_URL, DEFAULT_CLIENT_ID, saveConfig, createFileStorage, loadConfig } from "./config.mjs";
import { generateIdentity } from "./identity.mjs";
import { saveLimitedToken, startDeviceLogin, pollDeviceLogin } from "./auth.mjs";
import { flagString, flagBool } from "./args.mjs";

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

export async function identityGenerate({ flags, output, env = process.env }) {
  const identity = generateIdentity(env);
  const safe = { keyId: identity.keyId, algorithm: identity.algorithm, did: identity.did, publicKey: identity.publicKey, createdAt: identity.createdAt };
  output.emit({ json: flagBool(flags, "json") }, safe, (data) => `generated ${data.algorithm} identity ${data.keyId}\ndid: ${data.did}\npublic key: ${data.publicKey}`);
  return 0;
}
