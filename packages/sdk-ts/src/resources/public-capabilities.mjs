const RELEASE_CHANNELS = new Set(["preview", "beta", "ga"]);

const FALLBACK_CLIENT = Object.freeze({ available: false, minimumVersion: null });

export const FALLBACK_PUBLIC_CAPABILITIES = Object.freeze({
  schemaVersion: "public-capabilities.v1",
  releaseChannel: "preview",
  apiVersion: null,
  graphSchemaVersion: "research-neighborhood.v1",
  deviceAuthorization: Object.freeze({ enabled: false }),
  research: Object.freeze({
    read: true,
    prepare: false,
    submit: false,
    signing: "human-local-only",
  }),
  clients: Object.freeze({
    sdk: FALLBACK_CLIENT,
    cli: FALLBACK_CLIENT,
    mcp: FALLBACK_CLIENT,
  }),
});

function validClientCapability(value) {
  return value && typeof value === "object"
    && typeof value.available === "boolean"
    && (value.minimumVersion === null || typeof value.minimumVersion === "string");
}

/**
 * Validate and copy the public capability document. Invalid or incomplete
 * manifests fail closed instead of partially enabling a contribution flow.
 */
export function normalizePublicCapabilities(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return FALLBACK_PUBLIC_CAPABILITIES;
  if (value.schemaVersion !== "public-capabilities.v1") return FALLBACK_PUBLIC_CAPABILITIES;
  if (!RELEASE_CHANNELS.has(value.releaseChannel)) return FALLBACK_PUBLIC_CAPABILITIES;
  if (typeof value.apiVersion !== "string" || value.apiVersion.length === 0) return FALLBACK_PUBLIC_CAPABILITIES;
  if (value.graphSchemaVersion !== "research-neighborhood.v1") return FALLBACK_PUBLIC_CAPABILITIES;
  if (typeof value.deviceAuthorization?.enabled !== "boolean") return FALLBACK_PUBLIC_CAPABILITIES;
  if (value.research?.read !== true
    || typeof value.research?.prepare !== "boolean"
    || typeof value.research?.submit !== "boolean"
    || value.research?.signing !== "human-local-only") return FALLBACK_PUBLIC_CAPABILITIES;
  if (!validClientCapability(value.clients?.sdk)
    || !validClientCapability(value.clients?.cli)
    || !validClientCapability(value.clients?.mcp)) return FALLBACK_PUBLIC_CAPABILITIES;

  const client = (entry) => Object.freeze({
    available: entry.available,
    minimumVersion: entry.minimumVersion,
  });
  return Object.freeze({
    schemaVersion: "public-capabilities.v1",
    releaseChannel: value.releaseChannel,
    apiVersion: value.apiVersion,
    graphSchemaVersion: "research-neighborhood.v1",
    deviceAuthorization: Object.freeze({ enabled: value.deviceAuthorization.enabled }),
    research: Object.freeze({
      read: true,
      prepare: value.research.prepare,
      submit: value.research.submit,
      signing: "human-local-only",
    }),
    clients: Object.freeze({
      sdk: client(value.clients.sdk),
      cli: client(value.clients.cli),
      mcp: client(value.clients.mcp),
    }),
  });
}

export function createPublicCapabilitiesClient(http) {
  return Object.freeze({
    async get() {
      try {
        return normalizePublicCapabilities(await http.request("GET", "/meta/capabilities"));
      } catch {
        return FALLBACK_PUBLIC_CAPABILITIES;
      }
    },
  });
}
