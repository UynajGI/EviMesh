const PROBE_TIMEOUT_MS = 5_000;

function component(status, checkedAt, latencyMs) {
  return Object.freeze({ status, checkedAt, latencyMs });
}

async function httpProbe(url, { apiKey, fetchImpl, checkedAt }) {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return component(response.ok ? 'operational' : 'unavailable', checkedAt, Date.now() - startedAt);
  } catch {
    return component('unavailable', checkedAt, Date.now() - startedAt);
  }
}

async function storageProbe(bucket, checkedAt) {
  const startedAt = Date.now();
  try {
    if (!bucket || typeof bucket.head !== 'function') throw new TypeError('R2 binding is unavailable');
    // A missing sentinel is a valid result: the operation itself proves that
    // the binding and R2 control plane answered without reading user data.
    await bucket.head('__evimesh_public_health_probe__');
    return component('operational', checkedAt, Date.now() - startedAt);
  } catch {
    return component('unavailable', checkedAt, Date.now() - startedAt);
  }
}

export async function probePublicDependencies({ env, fetchImpl = fetch, now = new Date() } = {}) {
  const checkedAt = now.toISOString();
  const supabaseUrl = typeof env?.SUPABASE_URL === 'string' ? env.SUPABASE_URL.replace(/\/$/, '') : '';
  const apiKey = env?.SUPABASE_PUBLISHABLE_KEY ?? env?.SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl || !apiKey) {
    const unavailable = component('unavailable', checkedAt, 0);
    return Object.freeze({
      status: 'degraded',
      checkedAt,
      components: Object.freeze({ authentication: unavailable, database: unavailable, objectStorage: await storageProbe(env?.ARTIFACTS, checkedAt) }),
    });
  }

  const [authentication, database, objectStorage] = await Promise.all([
    httpProbe(`${supabaseUrl}/auth/v1/health`, { apiKey, fetchImpl, checkedAt }),
    httpProbe(`${supabaseUrl}/rest/v1/projects?select=project_id&limit=1`, { apiKey, fetchImpl, checkedAt }),
    storageProbe(env?.ARTIFACTS, checkedAt),
  ]);
  const components = Object.freeze({ authentication, database, objectStorage });
  const status = Object.values(components).every((entry) => entry.status === 'operational') ? 'operational' : 'degraded';
  return Object.freeze({ status, checkedAt, components });
}
