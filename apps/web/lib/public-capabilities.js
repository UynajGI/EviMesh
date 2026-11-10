export const FALLBACK_PUBLIC_CAPABILITIES = Object.freeze({
  schemaVersion: 'public-capabilities.v1',
  releaseChannel: 'preview',
  apiVersion: null,
  graphSchemaVersion: 'research-neighborhood.v1',
  deviceAuthorization: Object.freeze({ enabled: false }),
  research: Object.freeze({ read: true, prepare: false, submit: false, signing: 'human-local-only' }),
  clients: Object.freeze({
    sdk: Object.freeze({ available: false, minimumVersion: null }),
    cli: Object.freeze({ available: false, minimumVersion: null }),
    mcp: Object.freeze({ available: false, minimumVersion: null }),
  }),
});

const CLIENT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function validClient(value) {
  return value && typeof value === 'object'
    && typeof value.available === 'boolean'
    && (value.minimumVersion === null
      || (typeof value.minimumVersion === 'string' && CLIENT_VERSION_PATTERN.test(value.minimumVersion)));
}

export function normalizePublicCapabilities(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 'public-capabilities.v1') return FALLBACK_PUBLIC_CAPABILITIES;
  if (!['preview', 'beta', 'ga'].includes(value.releaseChannel)) return FALLBACK_PUBLIC_CAPABILITIES;
  if (typeof value.apiVersion !== 'string' || value.apiVersion.length === 0) return FALLBACK_PUBLIC_CAPABILITIES;
  if (value.graphSchemaVersion !== 'research-neighborhood.v1') return FALLBACK_PUBLIC_CAPABILITIES;
  if (typeof value.deviceAuthorization?.enabled !== 'boolean') return FALLBACK_PUBLIC_CAPABILITIES;
  if (value.research?.read !== true || typeof value.research?.prepare !== 'boolean' || typeof value.research?.submit !== 'boolean') return FALLBACK_PUBLIC_CAPABILITIES;
  if (value.research.signing !== 'human-local-only') return FALLBACK_PUBLIC_CAPABILITIES;
  if (!validClient(value.clients?.sdk) || !validClient(value.clients?.cli) || !validClient(value.clients?.mcp)) return FALLBACK_PUBLIC_CAPABILITIES;
  const client = (entry) => Object.freeze({ available: entry.available, minimumVersion: entry.minimumVersion });
  return Object.freeze({
    schemaVersion: 'public-capabilities.v1',
    releaseChannel: value.releaseChannel,
    apiVersion: value.apiVersion,
    graphSchemaVersion: 'research-neighborhood.v1',
    deviceAuthorization: Object.freeze({ enabled: value.deviceAuthorization.enabled }),
    research: Object.freeze({
      read: true,
      prepare: value.research.prepare,
      submit: value.research.submit,
      signing: 'human-local-only',
    }),
    clients: Object.freeze({
      sdk: client(value.clients.sdk),
      cli: client(value.clients.cli),
      mcp: client(value.clients.mcp),
    }),
  });
}

export async function fetchPublicCapabilities({ fetchImpl = fetch, apiUrl = process.env.NEXT_PUBLIC_EVIMESH_API_URL } = {}) {
  if (!apiUrl) return FALLBACK_PUBLIC_CAPABILITIES;
  try {
    const response = await fetchImpl(`${apiUrl}/meta/capabilities`, { headers: { accept: 'application/json' } });
    if (!response.ok) return FALLBACK_PUBLIC_CAPABILITIES;
    return normalizePublicCapabilities(await response.json());
  } catch {
    return FALLBACK_PUBLIC_CAPABILITIES;
  }
}
