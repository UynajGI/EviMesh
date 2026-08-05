const DEFAULT_INTERVAL_SECONDS = 5;
const LIMITED_SCOPES = new Set(["profile:read", "project:read"]);

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${field} is required`);
  return value.trim();
}

function assertLimitedScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some((scope) => !LIMITED_SCOPES.has(scope))) {
    throw new Error("device login returned a token with disallowed scopes");
  }
  return scopes;
}

export async function startDeviceLogin({ apiBaseUrl, clientId, fetchImpl = fetch } = {}) {
  const baseUrl = requiredText(apiBaseUrl, "apiBaseUrl").replace(/\/$/, "");
  clientId = requiredText(clientId, "clientId");
  const response = await fetchImpl(`${baseUrl}/auth/device`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "device login could not start");
  return { ...payload, interval: Number.isFinite(payload.interval) ? payload.interval : DEFAULT_INTERVAL_SECONDS };
}

export async function pollDeviceLogin({ apiBaseUrl, deviceCode, interval = DEFAULT_INTERVAL_SECONDS, maxAttempts = 60, fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const baseUrl = requiredText(apiBaseUrl, "apiBaseUrl").replace(/\/$/, "");
  deviceCode = requiredText(deviceCode, "deviceCode");
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetchImpl(`${baseUrl}/auth/device/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_code: deviceCode }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && typeof payload.access_token === "string") { assertLimitedScopes(payload.scopes); return payload; }
    if (payload.error && payload.error !== "authorization_pending") throw new Error(payload.error);
    await sleep(interval * 1000);
  }
  throw new Error("device login timed out");
}

export function saveLimitedToken(storage, token) {
  if (!token || typeof token.access_token !== "string") throw new TypeError("valid access token is required");
  assertLimitedScopes(token.scopes);
  storage.setItem("evimesh.cli.token", JSON.stringify({ access_token: token.access_token, scopes: token.scopes }));
}
