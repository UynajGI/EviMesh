const config = window.EVIMESH_CONFIG || {};
const storageKey = "evimesh.auth.session";
const status = document.querySelector("#auth-status");
function show(message) { status.textContent = message; }
function baseUrl() { return String(config.supabaseUrl || "").replace(/\/$/, ""); }
function headers() { return { apikey: config.anonKey || "", "Content-Type": "application/json" }; }
async function signIn(email, password) {
  const response = await fetch(`${baseUrl()}/auth/v1/token?grant_type=password`, { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || "Sign-in failed");
  localStorage.setItem(storageKey, JSON.stringify(payload));
  return payload;
}
document.querySelector("#email-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  try { await signIn(form.get("email"), form.get("password")); show("Signed in. Your session will be restored on refresh."); } catch (error) { show(error.message); }
});
document.querySelector("#github-button").addEventListener("click", () => {
  if (!baseUrl() || !config.anonKey) return show("Set EVIMESH_CONFIG.supabaseUrl and anonKey first.");
  const url = new URL(`${baseUrl()}/auth/v1/authorize`); url.searchParams.set("provider", "github"); url.searchParams.set("redirect_to", window.location.href); window.location.assign(url);
});
if (localStorage.getItem(storageKey)) show("Session restored. You are signed in.");
