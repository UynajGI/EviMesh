import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig, buildServerClient, SUPPORTED_PROTOCOL_VERSIONS, SERVER_INFO } from "../src/config.mjs";

test("resolveConfig prefers explicit environment values", () => {
  const config = resolveConfig({ EVIMESH_API_URL: "https://custom.example", EVIMESH_API_TOKEN: "evimesh_env_token" });
  assert.equal(config.apiUrl, "https://custom.example");
  assert.equal(config.token, "evimesh_env_token");
});

test("resolveConfig falls back to the shared CLI token store", () => {
  const dir = mkdtempSync(join(tmpdir(), "evimesh-mcp-cfg-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "state.json"), JSON.stringify({ "evimesh.cli.token": JSON.stringify({ access_token: "evimesh_stored", scopes: ["profile:read"] }) }));
  const config = resolveConfig({ EVIMESH_CONFIG_DIR: dir });
  assert.equal(config.token, "evimesh_stored");
});

test("resolveConfig yields no token when nothing is configured", () => {
  const dir = mkdtempSync(join(tmpdir(), "evimesh-mcp-cfg-"));
  const config = resolveConfig({ EVIMESH_CONFIG_DIR: dir });
  assert.equal(config.token, null);
});

test("buildServerClient produces a usable client bound to the configured base URL", () => {
  const config = resolveConfig({ EVIMESH_API_URL: "https://api.example.test", EVIMESH_API_TOKEN: "evimesh_token" });
  const client = buildServerClient({ config });
  assert.equal(client.http.baseUrl, "https://api.example.test");
  assert.ok(typeof client.projects.list === "function");
  assert.ok(typeof client.tasks.context === "function");
});

test("server metadata is stable", () => {
  assert.equal(SERVER_INFO.name, "evimesh-mcp");
  assert.ok(SUPPORTED_PROTOCOL_VERSIONS.includes("2024-11-05"));
});
