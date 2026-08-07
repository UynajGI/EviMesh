import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_API_URL = "https://api.evimesh.com";
export const DEFAULT_CLIENT_ID = "evimesh-cli";
export const TOKEN_STORAGE_KEY = "evimesh.cli.token";

export class CliConfigError extends Error {
  constructor(message, code = "CLI_CONFIG_INVALID") {
    super(message);
    this.name = "CliConfigError";
    this.code = code;
  }
}

/** Resolve the config directory, honoring EVIMESH_CONFIG_DIR for tests. */
export function configDir(env = process.env) {
  const override = env.EVIMESH_CONFIG_DIR;
  if (override && override.trim().length > 0) return override.trim();
  return join(homedir(), ".evimesh");
}

function configPath(dir) {
  return join(dir, "config.json");
}

export function ensureConfigDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function loadConfig(env = process.env) {
  const dir = configDir(env);
  const path = configPath(dir);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveConfig(patch, env = process.env) {
  const dir = ensureConfigDir(configDir(env));
  const current = loadConfig(env) ?? {};
  const merged = { ...current, ...patch };
  writeFileSync(configPath(dir), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

export function requireConfig(env = process.env) {
  const config = loadConfig(env);
  if (!config) {
    throw new CliConfigError("no configuration found; run `sq config init` first", "CLI_CONFIG_MISSING");
  }
  return config;
}

/** Minimal filesystem-backed key/value store matching the SDK storage contract. */
export function createFileStorage(env = process.env) {
  const dir = ensureConfigDir(configDir(env));
  const path = join(dir, "state.json");
  function read() {
    if (!existsSync(path)) return {};
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {
    getItem(key) {
      const store = read();
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      const store = read();
      store[key] = value;
      writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    },
    removeItem(key) {
      const store = read();
      delete store[key];
      writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    },
  };
}

export function loadStoredToken(env = process.env) {
  const raw = createFileStorage(env).getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.access_token === "string" ? parsed : null;
  } catch {
    return null;
  }
}
