const baseUrl = (process.env.SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error("SUPABASE_ANON_KEY is required; use the publishable/anon key only.");
  process.exit(2);
}

const explicitEmail = process.env.EVIMESH_AUTH_TEST_EMAIL;
const email = explicitEmail || `m4-email-${Date.now()}@example.test`;
const password = process.env.EVIMESH_AUTH_TEST_PASSWORD || `EviMesh-M4-${crypto.randomUUID()}!a1`;

async function authRequest(path, body) {
  const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const signup = await authRequest("signup", { email, password });
const signupAlreadyExists = signup.response.status === 422 && explicitEmail;
if (!signup.response.ok && !signupAlreadyExists) {
  console.error(`Email signup failed (HTTP ${signup.response.status}).`);
  process.exit(1);
}

const login = await authRequest("token?grant_type=password", { email, password });
if (!login.response.ok || typeof login.payload.access_token !== "string") {
  console.error(`Email login failed (HTTP ${login.response.status}).`);
  process.exit(1);
}

if (login.payload.user?.email !== email) {
  console.error("Email login returned an unexpected user.");
  process.exit(1);
}

console.log(JSON.stringify({
  status: "pass",
  email,
  signup: signupAlreadyExists ? "existing-test-account" : "created-test-account",
  login: "pass",
}));
