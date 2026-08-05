async function payloadDigest(payload) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function responseSnapshot(response) {
  return response.clone().text().then(async (body) => ({
    body,
    status: response.status,
    headers: [...response.headers.entries()],
  }));
}

export async function executeIdempotently({ store, key, payload, execute } = {}) {
  if (!store || typeof store.get !== "function" || typeof store.put !== "function") throw new TypeError("idempotency store is required");
  if (typeof key !== "string" || key.length === 0 || key.length > 128) throw new TypeError("idempotency key is invalid");
  const digest = await payloadDigest(payload ?? "");
  const cached = await store.get(key);
  if (cached) {
    if (cached.payloadDigest !== digest) return { conflict: true, status: 409, body: { code: "IDEMPOTENCY_CONFLICT", message: "key was used with a different payload" } };
    return { ...cached, replayed: true };
  }
  const result = await execute();
  await store.put(key, { ...result, payloadDigest: digest });
  return { ...result, replayed: false };
}

/** Hono middleware that caches a successful response for an Idempotency-Key. */
export function createIdempotencyMiddleware({ store } = {}) {
  return async (context, next) => {
    const key = context.req.header("idempotency-key");
    if (!key) {
      await next();
      return;
    }

    const payload = await context.req.raw.clone().text();
    const result = await executeIdempotently({
      store,
      key,
      payload,
      execute: async () => {
        await next();
        return responseSnapshot(context.res);
      },
    });

    if (result.conflict) {
      context.res = Response.json(result.body, { status: result.status });
      return;
    }
    if (result.replayed) {
      context.res = new Response(result.body, {
        status: result.status,
        headers: result.headers,
      });
    }
  };
}
