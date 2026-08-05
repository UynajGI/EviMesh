import test from "node:test";
import assert from "node:assert/strict";
import { clearSession, createSupabaseAuthClient, persistSession, restoreSession } from "../src/auth.mjs";

function createStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("starts email and GitHub auth with a public key", async () => {
  const requests = [];
  const client = createSupabaseAuthClient({
    supabaseUrl: "https://example.supabase.co", anonKey: "public-anon-key",
    fetchImpl: async (url, options) => { requests.push({ url, options }); return { ok: true, async json() { return { access_token: "jwt", expires_at: 200 }; } }; },
  });
  const session = await client.signInWithPassword({ email: "a@example.test", password: "pass" });
  assert.equal(session.access_token, "jwt");
  assert.equal(requests[0].options.headers.apikey, "public-anon-key");
  assert.match(client.signInWithGithub({ redirectTo: "https://evimesh.com/" }), /provider=github/);
});

test("persists, restores, expires, and clears the browser session", () => {
  const storage = createStorage();
  const session = { access_token: "jwt", expires_at: 200 };
  persistSession(storage, session);
  assert.deepEqual(restoreSession(storage, 199), session);
  assert.equal(restoreSession(storage, 200), null);
  clearSession(storage);
  assert.equal(restoreSession(storage, 1), null);
});
