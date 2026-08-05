const SESSION_STORAGE_KEY = "evimesh.auth.session";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${field} is required`);
  return value.trim();
}

export function createSupabaseAuthClient({ supabaseUrl, anonKey, fetchImpl = fetch } = {}) {
  const baseUrl = requiredText(supabaseUrl, "supabaseUrl").replace(/\/$/, "");
  anonKey = requiredText(anonKey, "anonKey");
  const request = async (path, options = {}) => {
    const response = await fetchImpl(`${baseUrl}/auth/v1/${path}`, {
      ...options,
      headers: { apikey: anonKey, "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_description || payload.msg || "Supabase Auth request failed");
    return payload;
  };
  return {
    signInWithPassword({ email, password }) {
      return request("token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
    },
    signInWithGithub({ redirectTo } = {}) {
      const url = new URL(`${baseUrl}/auth/v1/authorize`);
      url.searchParams.set("provider", "github");
      if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
      return url.toString();
    },
  };
}

export function restoreSession(storage, now = Math.floor(Date.now() / 1000)) {
  const serialized = storage?.getItem(SESSION_STORAGE_KEY);
  if (!serialized) return null;
  try {
    const session = JSON.parse(serialized);
    if (typeof session.access_token !== "string" || (session.expires_at && session.expires_at <= now)) return null;
    return session;
  } catch { return null; }
}

export function persistSession(storage, session) {
  if (!storage || typeof storage.setItem !== "function") throw new TypeError("storage is required");
  if (!session || typeof session.access_token !== "string") throw new TypeError("valid session is required");
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(storage) { storage?.removeItem?.(SESSION_STORAGE_KEY); }
