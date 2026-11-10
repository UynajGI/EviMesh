import {
  collectPublicStatus,
  currentPublicStatus,
  persistPublicStatus,
  publicStatusTransitions,
  renderStatusPage,
} from './status.mjs';
import { createDurableObjectStatusStore, StatusStateDurableObject } from './state-do.mjs';

const SECURITY_HEADERS = Object.freeze({
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()'
});

function response(body, init = {}) {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set('cache-control', 'no-store');
  return new Response(body, { ...init, headers });
}

async function route(request, env, executionContext) {
  const url = new URL(request.url);
  const runtimeEnv = { ...env, STATUS_STATE: createDurableObjectStatusStore(env.STATUS_STATE) };
  if (!['GET', 'HEAD'].includes(request.method)) return response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  if (url.pathname === '/robots.txt') return response('User-agent: *\nAllow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (url.pathname === '/api/status') {
    const snapshot = await currentPublicStatus({ env: runtimeEnv, executionContext });
    return response(request.method === 'HEAD' ? null : JSON.stringify(snapshot), {
      status: snapshot.status === 'operational' ? 200 : 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  if (url.pathname === '/') {
    const [snapshot, transitions] = await Promise.all([
      currentPublicStatus({ env: runtimeEnv, executionContext }),
      publicStatusTransitions(runtimeEnv.STATUS_STATE),
    ]);
    return response(request.method === 'HEAD' ? null : renderStatusPage(snapshot, transitions), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  return response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export default {
  fetch: route,
  async scheduled(_controller, env, executionContext) {
    executionContext.waitUntil((async () => {
      const runtimeEnv = { ...env, STATUS_STATE: createDurableObjectStatusStore(env.STATUS_STATE) };
      const snapshot = await collectPublicStatus({ env: runtimeEnv });
      await persistPublicStatus(runtimeEnv.STATUS_STATE, snapshot);
      console.log(JSON.stringify({ event: 'status.snapshot', status: snapshot.status, checkedAt: snapshot.checkedAt, components: Object.fromEntries(Object.entries(snapshot.components).map(([name, entry]) => [name, entry.status])) }));
    })());
  },
};

export { route, StatusStateDurableObject };
