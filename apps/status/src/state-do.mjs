function keyFrom(request) {
  const url = new URL(request.url);
  const prefix = '/value/';
  if (!url.pathname.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export class StatusStateDurableObject {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const key = keyFrom(request);
    if (!key) return new Response('Not Found', { status: 404 });
    if (request.method === 'GET') {
      const value = await this.storage.get(key);
      return value === undefined
        ? new Response(null, { status: 404 })
        : new Response(value, { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    if (request.method === 'PUT') {
      const value = await request.text();
      await this.storage.put(key, value);
      return new Response(null, { status: 204 });
    }
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, PUT' } });
  }
}

export function createDurableObjectStatusStore(namespace) {
  if (!namespace || typeof namespace.getByName !== 'function') return namespace;
  const stub = namespace.getByName('public-status');
  return {
    async get(key, type) {
      const response = await stub.fetch(`https://status-state/value/${encodeURIComponent(key)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`status state read failed: ${response.status}`);
      const value = await response.text();
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) {
      const response = await stub.fetch(`https://status-state/value/${encodeURIComponent(key)}`, { method: 'PUT', body: value });
      if (!response.ok) throw new Error(`status state write failed: ${response.status}`);
    },
  };
}
