import { createClient, FALLBACK_PUBLIC_CAPABILITIES } from "../../sdk-ts/src/index.mjs";
import { flagBool, flagString } from "./args.mjs";
import { DEFAULT_API_URL, loadConfig } from "./config.mjs";

export class CliCapabilityError extends Error {
  constructor(message, code = "CLI_CAPABILITY_UNAVAILABLE") {
    super(message);
    this.name = "CliCapabilityError";
    this.code = code;
  }
}

function configuredApiUrl(flags, env) {
  return flagString(flags, "api-url", loadConfig(env)?.apiUrl ?? DEFAULT_API_URL);
}

/** Discover public server capabilities without requiring credentials or config. */
export async function discoverPublicCapabilities({ flags = {}, env = process.env, fetchImpl } = {}) {
  const options = { baseUrl: configuredApiUrl(flags, env) };
  if (fetchImpl) options.fetchImpl = fetchImpl;
  return createClient(options).capabilities.get();
}

export function assertPublicCapability(capabilities, capability, command) {
  const enabled = capability === "deviceAuthorization"
    ? capabilities?.deviceAuthorization?.enabled === true
    : capability === "research.prepare"
      ? capabilities?.research?.prepare === true
      : capability === "research.submit"
        ? capabilities?.research?.submit === true
        : false;
  if (enabled) return capabilities;
  throw new CliCapabilityError(
    `${command} is not advertised by this EviMesh deployment; inspect \`sq capabilities --json\` and try again after the capability is enabled`,
  );
}

export async function requirePublicCapability({ client = null, capability, command, flags = {}, env = process.env, fetchImpl } = {}) {
  const manifest = client?.capabilities?.get
    ? await client.capabilities.get()
    : await discoverPublicCapabilities({ flags, env, fetchImpl });
  return assertPublicCapability(manifest ?? FALLBACK_PUBLIC_CAPABILITIES, capability, command);
}

export async function capabilitiesCommand({ flags, output, env = process.env, fetchImpl } = {}) {
  const capabilities = await discoverPublicCapabilities({ flags, env, fetchImpl });
  output.emit({ json: flagBool(flags, "json") }, capabilities, (data) => [
    `release: ${data.releaseChannel}`,
    `api: ${data.apiVersion ?? "unavailable"}`,
    `device authorization: ${data.deviceAuthorization.enabled ? "available" : "unavailable"}`,
    `research prepare: ${data.research.prepare ? "available" : "unavailable"}`,
    `research submit: ${data.research.submit ? "available" : "unavailable"}`,
    "research signing: human-local-only",
  ].join("\n"));
  return 0;
}
