const PROBE_TIMEOUT_MS = 5_000;
const FRESH_FOR_MS = 10 * 60 * 1_000;
const LATEST_KEY = 'public-status:v1:latest';
const TRANSITIONS_KEY = 'public-status:v1:transitions';
const MAX_TRANSITIONS = 90;

const COMPONENT_LABELS = Object.freeze({
  website: 'Web',
  api: 'API',
  database: 'Database',
  objectStorage: 'Object Storage',
  authentication: 'Authentication',
});

function isoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new TypeError('status time must be valid');
  return date.toISOString();
}

function component(status, latencyMs = 0) {
  return Object.freeze({
    status: status === 'operational' ? 'operational' : 'unavailable',
    latencyMs: Math.max(0, Math.round(Number(latencyMs) || 0)),
  });
}

async function timedFetch(url, fetchImpl) {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json, text/html;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return { response, latencyMs: Date.now() - startedAt };
  } catch {
    return { response: null, latencyMs: Date.now() - startedAt };
  }
}

async function parseJson(response) {
  try {
    return await response?.json();
  } catch {
    return null;
  }
}

function dependencyComponent(payload, name) {
  const entry = payload?.components?.[name];
  return component(entry?.status, entry?.latencyMs);
}

export async function collectPublicStatus({ env = {}, fetchImpl = fetch, now = new Date() } = {}) {
  const webUrl = String(env.EVIMESH_WEB_URL ?? 'https://evimesh.com').replace(/\/$/, '');
  const apiUrl = String(env.EVIMESH_API_URL ?? 'https://api.evimesh.com').replace(/\/$/, '');
  const [webProbe, apiProbe, dependencyProbe] = await Promise.all([
    timedFetch(`${webUrl}/`, fetchImpl),
    timedFetch(`${apiUrl}/health`, fetchImpl),
    timedFetch(`${apiUrl}/health/dependencies`, fetchImpl),
  ]);
  const [apiPayload, dependencyPayload] = await Promise.all([
    parseJson(apiProbe.response),
    parseJson(dependencyProbe.response),
  ]);
  const components = Object.freeze({
    website: component(webProbe.response?.ok ? 'operational' : 'unavailable', webProbe.latencyMs),
    api: component(apiProbe.response?.ok && apiPayload?.status === 'ok' ? 'operational' : 'unavailable', apiProbe.latencyMs),
    database: dependencyComponent(dependencyPayload, 'database'),
    objectStorage: dependencyComponent(dependencyPayload, 'objectStorage'),
    authentication: dependencyComponent(dependencyPayload, 'authentication'),
  });
  const status = Object.values(components).every((entry) => entry.status === 'operational')
    ? 'operational'
    : 'degraded';
  return Object.freeze({
    schemaVersion: 'public-status.v1',
    status,
    checkedAt: isoDate(now),
    components,
  });
}

function statusSignature(snapshot) {
  return Object.entries(snapshot.components)
    .map(([name, entry]) => `${name}:${entry.status}`)
    .join('|');
}

async function readJson(namespace, key) {
  if (!namespace || typeof namespace.get !== 'function') return null;
  try {
    return await namespace.get(key, 'json');
  } catch {
    return null;
  }
}

export async function persistPublicStatus(namespace, snapshot) {
  if (!namespace || typeof namespace.put !== 'function') return snapshot;
  const previous = await readJson(namespace, LATEST_KEY);
  await namespace.put(LATEST_KEY, JSON.stringify(snapshot));
  if (previous && statusSignature(previous) === statusSignature(snapshot)) return snapshot;

  const transitions = await readJson(namespace, TRANSITIONS_KEY);
  const nextTransitions = [
    {
      changedAt: snapshot.checkedAt,
      status: snapshot.status,
      components: Object.fromEntries(Object.entries(snapshot.components).map(([name, entry]) => [name, entry.status])),
    },
    ...(Array.isArray(transitions) ? transitions : []),
  ].slice(0, MAX_TRANSITIONS);
  await namespace.put(TRANSITIONS_KEY, JSON.stringify(nextTransitions));
  return snapshot;
}

function isFresh(snapshot, now) {
  const checkedAt = Date.parse(snapshot?.checkedAt ?? '');
  return Number.isFinite(checkedAt) && now.valueOf() - checkedAt >= 0 && now.valueOf() - checkedAt <= FRESH_FOR_MS;
}

export async function currentPublicStatus({ env = {}, fetchImpl = fetch, now = new Date(), executionContext = null } = {}) {
  const cached = await readJson(env.STATUS_STATE, LATEST_KEY);
  if (isFresh(cached, now)) return cached;
  const snapshot = await collectPublicStatus({ env, fetchImpl, now });
  const write = persistPublicStatus(env.STATUS_STATE, snapshot);
  if (executionContext?.waitUntil) executionContext.waitUntil(write);
  else await write;
  return snapshot;
}

export async function publicStatusTransitions(namespace) {
  const transitions = await readJson(namespace, TRANSITIONS_KEY);
  return Array.isArray(transitions) ? transitions : [];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusText(status) {
  return status === 'operational' ? 'Operational' : 'Unavailable';
}

function overallText(status) {
  return status === 'operational' ? 'All systems operational' : 'Service disruption detected';
}

function renderComponentRows(snapshot) {
  return Object.entries(COMPONENT_LABELS).map(([name, label]) => {
    const entry = snapshot.components[name] ?? component('unavailable');
    return `<li class="component-row"><span>${escapeHtml(label)}</span><span class="state state--${entry.status}"><i aria-hidden="true"></i>${statusText(entry.status)}</span></li>`;
  }).join('');
}

function renderTransitions(transitions) {
  if (transitions.length === 0) return '<p class="empty">No status transitions recorded.</p>';
  return `<ol class="transitions">${transitions.slice(0, 8).map((transition) => `<li><time datetime="${escapeHtml(transition.changedAt)}">${escapeHtml(new Date(transition.changedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))} UTC</time><span>${escapeHtml(overallText(transition.status))}</span></li>`).join('')}</ol>`;
}

export function renderStatusPage(snapshot, transitions = []) {
  const title = overallText(snapshot.status);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta http-equiv="refresh" content="60">
  <title>${escapeHtml(title)} · EviMesh Status</title>
  <style>
    :root{--paper:#f3f1eb;--ink:#111822;--muted:#666b73;--rule:#c9c8c2;--cobalt:#2063bf;--positive:#1d6b50;--negative:#a23d33;--surface:#faf9f5;--sans:"Inter Tight",Inter,Arial,sans-serif;--serif:"Source Serif 4",Georgia,serif;--mono:"IBM Plex Mono",Consolas,monospace}
    @media(prefers-color-scheme:dark){:root{--paper:#0d1117;--ink:#f4f5f7;--muted:#a5abb4;--rule:#353b44;--cobalt:#70a6f5;--positive:#74cba7;--negative:#ee9188;--surface:#141a22}}
    *{box-sizing:border-box}html{background:var(--paper);color:var(--ink);font-family:var(--sans)}body{margin:0;min-height:100vh}a{color:inherit}.shell{width:min(1180px,calc(100% - 40px));margin:auto}.masthead{height:86px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--rule)}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-weight:700;letter-spacing:-.02em}.mark{width:28px;height:28px;background:var(--ink);color:var(--paper);display:grid;place-items:center;font-family:var(--mono);font-size:13px}.brand em{color:var(--cobalt);font-style:normal}.return{font-size:13px;text-underline-offset:4px}.hero{display:grid;grid-template-columns:2fr 10fr;gap:20px;padding:72px 0 56px;border-bottom:1px solid var(--rule)}.eyebrow{font:700 11px/1.2 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--cobalt)}h1{font:500 clamp(48px,7.2vw,104px)/.9 var(--serif);letter-spacing:-.055em;margin:0;max-width:1000px}.summary{display:grid;grid-template-columns:7fr 5fr;gap:20px;padding:42px 0 72px}.status-block{border-top:3px solid var(--ink)}.overall{display:flex;align-items:center;justify-content:space-between;padding:21px 0;border-bottom:1px solid var(--rule);font-size:18px}.state{display:inline-flex;align-items:center;gap:9px;font:700 11px/1 var(--mono);letter-spacing:.07em;text-transform:uppercase}.state i{display:block;width:8px;height:8px;background:currentColor}.state--operational{color:var(--positive)}.state--unavailable{color:var(--negative)}.components{list-style:none;padding:0;margin:0}.component-row{display:flex;justify-content:space-between;align-items:center;min-height:58px;border-bottom:1px solid var(--rule)}.meta{margin-top:17px;color:var(--muted);font:12px/1.5 var(--mono)}.log{border-top:1px solid var(--rule);padding-top:20px}.log h2{font:700 11px/1.2 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--cobalt);margin:0 0 22px}.transitions{list-style:none;padding:0;margin:0}.transitions li{display:grid;grid-template-columns:140px 1fr;gap:14px;padding:13px 0;border-bottom:1px solid var(--rule);font-size:14px}.transitions time,.empty{color:var(--muted);font:12px/1.5 var(--mono)}footer{display:flex;justify-content:space-between;border-top:1px solid var(--rule);padding:24px 0 42px;color:var(--muted);font-size:12px}
    @media(max-width:760px){.shell{width:min(100% - 28px,1180px)}.masthead{height:72px}.hero{grid-template-columns:1fr;padding:44px 0 38px}.summary{grid-template-columns:1fr;padding:30px 0 56px;gap:42px}h1{font-size:clamp(44px,15vw,68px)}.transitions li{grid-template-columns:1fr;gap:4px}footer{display:grid;gap:8px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="masthead"><a class="brand" href="https://evimesh.com"><span class="mark" aria-hidden="true">E</span><span>Evi<em>Mesh</em></span></a><a class="return" href="https://evimesh.com">Back to EviMesh</a></header>
    <section class="hero"><p class="eyebrow">Service status</p><h1>${escapeHtml(title)}</h1></section>
    <section class="summary" aria-label="Current service status">
      <div class="status-block"><div class="overall"><strong>Public services</strong><span class="state state--${snapshot.status === 'operational' ? 'operational' : 'unavailable'}"><i aria-hidden="true"></i>${escapeHtml(snapshot.status)}</span></div><ul class="components">${renderComponentRows(snapshot)}</ul><p class="meta">Checked <time datetime="${escapeHtml(snapshot.checkedAt)}">${escapeHtml(new Date(snapshot.checkedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'long', timeZone: 'UTC' }))} UTC</time> · refreshes every minute</p></div>
      <aside class="log"><h2>Monitoring log</h2>${renderTransitions(transitions)}</aside>
    </section>
    <footer><span>EviMesh public infrastructure</span><a href="https://evimesh.com/security">Security</a></footer>
  </main>
</body>
</html>`;
}
