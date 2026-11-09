import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_PUBLIC_CAPABILITIES } from "../../sdk-ts/src/index.mjs";
import { HELP_TEXT } from "../src/main.mjs";
import { assertPublicCapability, capabilitiesCommand, discoverPublicCapabilities } from "../src/capabilities.mjs";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === "content-type" ? "application/json" : null) },
    text: async () => JSON.stringify(body),
  };
}

function liveCapabilities() {
  return {
    schemaVersion: "public-capabilities.v1",
    releaseChannel: "beta",
    apiVersion: "1.0.0-rc.1",
    graphSchemaVersion: "research-neighborhood.v1",
    deviceAuthorization: { enabled: true },
    research: { read: true, prepare: true, submit: false, signing: "human-local-only" },
    clients: {
      sdk: { available: true, minimumVersion: "1.0.0-rc.1" },
      cli: { available: true, minimumVersion: "1.0.0-rc.1" },
      mcp: { available: false, minimumVersion: null },
    },
  };
}

test("capabilities command emits the validated manifest as stable JSON data", async () => {
  let emitted = null;
  const output = { emit: (options, data) => { emitted = { options, data }; } };
  const fetchImpl = async () => jsonResponse(200, liveCapabilities());
  assert.equal(await capabilitiesCommand({ flags: { json: true, "api-url": "https://api.test" }, output, env: {}, fetchImpl }), 0);
  assert.deepEqual(emitted.options, { json: true });
  assert.equal(emitted.data.releaseChannel, "beta");
  assert.equal(emitted.data.research.prepare, true);
});

test("capability discovery needs no config and fails closed when unreachable", async () => {
  const live = await discoverPublicCapabilities({
    flags: { "api-url": "https://api.test" },
    env: {},
    fetchImpl: async () => jsonResponse(200, liveCapabilities()),
  });
  assert.equal(live.deviceAuthorization.enabled, true);

  const offline = await discoverPublicCapabilities({
    flags: { "api-url": "https://api.test" },
    env: {},
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(offline, FALLBACK_PUBLIC_CAPABILITIES);
  assert.throws(
    () => assertPublicCapability(offline, "research.submit", "sq research submit"),
    (error) => error.code === "CLI_CAPABILITY_UNAVAILABLE",
  );
});

test("offline help labels server-dependent flows without hiding local signing", () => {
  assert.match(HELP_TEXT, /auth login\s+Capability-gated Device Auth/);
  assert.match(HELP_TEXT, /research prepare\s+Capability-gated/);
  assert.match(HELP_TEXT, /research submit\s+Capability-gated/);
  assert.match(HELP_TEXT, /research sign\s+Human-local signing step/);
});
