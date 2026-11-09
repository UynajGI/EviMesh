const RELEASE_CHANNELS = new Set(['preview', 'beta', 'ga']);
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const PUBLIC_CAPABILITIES_SCHEMA_VERSION = 'public-capabilities.v1';
export const API_VERSION = '0.3.0';
export const RESEARCH_GRAPH_SCHEMA_VERSION = 'research-neighborhood.v1';

function enabled(value) {
  return value === true || value === 'true';
}

function releaseChannel(value) {
  return RELEASE_CHANNELS.has(value) ? value : 'preview';
}

function clientVersion(value) {
  return typeof value === 'string' && VERSION_PATTERN.test(value) ? value : null;
}

function clientCapability(value) {
  const minimumVersion = clientVersion(value);
  return Object.freeze({ available: minimumVersion !== null, minimumVersion });
}

/**
 * Build the public, non-secret capability document shared by the website and
 * installable clients. An environment flag is necessary but never sufficient:
 * the corresponding runtime dependency must also be wired before a capability
 * can be advertised.
 */
export function resolvePublicCapabilities({
  env = {},
  deviceAuthorizationAvailable = false,
  researchPrepareAvailable = false,
  researchSubmitAvailable = false,
} = {}) {
  return Object.freeze({
    schemaVersion: PUBLIC_CAPABILITIES_SCHEMA_VERSION,
    releaseChannel: releaseChannel(env.EVIMESH_RELEASE_CHANNEL),
    apiVersion: API_VERSION,
    graphSchemaVersion: RESEARCH_GRAPH_SCHEMA_VERSION,
    deviceAuthorization: Object.freeze({
      enabled: enabled(env.EVIMESH_DEVICE_AUTH_ENABLED) && deviceAuthorizationAvailable === true,
    }),
    research: Object.freeze({
      read: true,
      prepare: enabled(env.EVIMESH_RESEARCH_PREPARE_ENABLED) && researchPrepareAvailable === true,
      submit: enabled(env.EVIMESH_RESEARCH_SUBMIT_ENABLED) && researchSubmitAvailable === true,
      signing: 'human-local-only',
    }),
    clients: Object.freeze({
      sdk: clientCapability(env.EVIMESH_MINIMUM_SDK_VERSION),
      cli: clientCapability(env.EVIMESH_MINIMUM_CLI_VERSION),
      mcp: clientCapability(env.EVIMESH_MINIMUM_MCP_VERSION),
    }),
  });
}
