import { createClient } from "../../sdk-ts/src/index.mjs";
import { DEFAULT_API_URL, loadStoredToken, requireConfig } from "./config.mjs";
import { flagString } from "./args.mjs";

/** Build an SDK client from CLI config, letting flags override apiUrl/token. */
export function buildClient(flags, { env = process.env, fetchImpl } = {}) {
  const config = requireConfig(env);
  const baseUrl = flagString(flags, "api-url", config.apiUrl ?? DEFAULT_API_URL);
  const token = flagString(flags, "token", loadStoredToken(env)?.access_token ?? config.token ?? null);
  const options = { baseUrl };
  if (token) options.token = token;
  if (fetchImpl) options.fetchImpl = fetchImpl;
  return createClient(options);
}
