import { createClient } from "../../../packages/sdk-ts/src/index.mjs";
import { DEFAULT_API_URL, loadStoredToken, configDir } from "../../../packages/cli/src/config.mjs";

export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(["2024-11-05", "2025-03-26", "2025-06-18"]);
export const SERVER_INFO = Object.freeze({ name: "evimesh-mcp", version: "0.3.0" });

export class McpConfigError extends Error {
  constructor(message, code = "MCP_CONFIG_INVALID") {
    super(message);
    this.name = "McpConfigError";
    this.code = code;
  }
}

/**
 * Resolve server configuration. Explicit environment wins; otherwise the
 * shared CLI configuration directory (~/.evimesh, EVIMESH_CONFIG_DIR override)
 * supplies the limited token stored by `sq auth login`.
 */
export function resolveConfig(env = process.env) {
  const apiUrl = env.EVIMESH_API_URL ?? DEFAULT_API_URL;
  const token = env.EVIMESH_API_TOKEN ?? loadStoredToken(env)?.access_token ?? null;
  return Object.freeze({ apiUrl, token, configDir: configDir(env) });
}

/** Build the SDK client used by every resource and tool. */
export function buildServerClient({ config, fetchImpl } = {}) {
  if (!config) throw new McpConfigError("config is required");
  const options = { baseUrl: config.apiUrl };
  if (config.token) options.token = config.token;
  if (fetchImpl) options.fetchImpl = fetchImpl;
  return createClient(options);
}
