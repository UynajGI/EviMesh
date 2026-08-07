import { errorFromResponse, EviMeshError } from "./errors.mjs";
import { generateIdempotencyKey } from "./idempotency.mjs";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function requiredBaseUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) throw new EviMeshError("baseUrl is required");
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new EviMeshError(`baseUrl must be an absolute URL: ${value}`);
  }
}

function appendQuery(path, query) {
  if (!query) return path;
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) return path;
  const parameters = new URLSearchParams();
  for (const [key, value] of entries) parameters.set(key, String(value));
  return `${path}?${parameters.toString()}`;
}

async function parseBody(response) {
  const contentType = response.headers?.get?.("content-type") ?? "";
  const text = await response.text();
  if (contentType.includes("application/x-ndjson")) return text;
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Build a typed EviMesh API client. Auth accepts a Supabase JWT or an API token. */
export function createEviMeshClient({
  baseUrl,
  token = null,
  tokenProvider = null,
  fetchImpl = fetch,
  idempotencyKeyGenerator = null,
  defaultHeaders = {},
} = {}) {
  const base = requiredBaseUrl(baseUrl);
  if (token !== null && tokenProvider !== null) throw new EviMeshError("provide either token or tokenProvider, not both");
  if (tokenProvider !== null && typeof tokenProvider !== "function") throw new EviMeshError("tokenProvider must be a function");
  const nextIdempotencyKey = idempotencyKeyGenerator ?? (() => generateIdempotencyKey());

  async function authorizationHeader() {
    if (tokenProvider !== null) {
      const provided = await tokenProvider();
      return provided ? { authorization: `Bearer ${provided}` } : {};
    }
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  async function request(method, path, { query = null, body = undefined, headers = {}, ifMatch = null, idempotencyKey = undefined, raw = false } = {}) {
    const upperMethod = method.toUpperCase();
    const requestHeaders = { accept: "application/json", ...defaultHeaders, ...(await authorizationHeader()), ...headers };
    if (ifMatch !== null) requestHeaders["if-match"] = ifMatch;
    let payload;
    if (body !== undefined) {
      if (raw) {
        payload = body;
      } else {
        requestHeaders["content-type"] = "application/json";
        payload = JSON.stringify(body);
      }
    }
    if (WRITE_METHODS.has(upperMethod)) {
      const key = idempotencyKey === false ? null : idempotencyKey ?? nextIdempotencyKey();
      if (key) requestHeaders["idempotency-key"] = key;
    }
    const response = await fetchImpl(`${base}${appendQuery(path, query)}`, { method: upperMethod, headers: requestHeaders, body: payload });
    const parsed = await parseBody(response);
    if (!response.ok) {
      throw errorFromResponse({ status: response.status, body: parsed && typeof parsed === "object" ? parsed : {} });
    }
    return parsed;
  }

  async function* paginate(path, { query = {}, limit = 50 } = {}) {
    let cursor = null;
    for (;;) {
      const page = await request("GET", path, { query: { ...query, limit, cursor } });
      const items = Array.isArray(page?.items) ? page.items : [];
      for (const item of items) yield item;
      cursor = page?.nextCursor ?? null;
      if (!cursor || items.length === 0) return;
    }
  }

  return Object.freeze({ baseUrl: base, request, paginate });
}
