import test from "node:test";
import assert from "node:assert/strict";
import { pollDeviceLogin, saveLimitedToken, startDeviceLogin } from "../src/auth.mjs";

test("starts device login and polls until a limited token is issued", async () => {
  const requests = [];
  let poll = 0;
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/auth/device")) return { ok: true, async json() { return { device_code: "device_1", user_code: "ABCD", interval: 0 }; } };
    poll += 1;
    return poll === 1 ? { ok: false, async json() { return { error: "authorization_pending" }; } } : { ok: true, async json() { return { access_token: "limited", scopes: ["project:read"] }; } };
  };
  const device = await startDeviceLogin({ apiBaseUrl: "https://api.evimesh.com", clientId: "evimesh-cli", fetchImpl });
  const token = await pollDeviceLogin({ apiBaseUrl: "https://api.evimesh.com", deviceCode: device.device_code, interval: 0, fetchImpl, sleep: async () => {} });
  assert.equal(token.access_token, "limited");
  assert.equal(requests.length, 3);
});

test("does not save unrestricted CLI tokens", () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value) };
  assert.throws(() => saveLimitedToken(storage, { access_token: "full", scopes: ["admin"] }), /disallowed scopes/);
  saveLimitedToken(storage, { access_token: "limited", scopes: ["profile:read"] });
  assert.match(values.get("evimesh.cli.token"), /limited/);
});
