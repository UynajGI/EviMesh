# Supabase Email Authentication

M4-01 uses Supabase Auth's email/password provider. The repository keeps the
provider configuration in `supabase/config.toml` for local development and
keeps hosted-project settings in the Supabase Dashboard rather than in Git.

## Local verification

Start the local Supabase stack, obtain its publishable key with
`supabase status`, and run:

```powershell
$env:SUPABASE_ANON_KEY = "<local publishable or anon key>"
pnpm auth:test:email
```

The command creates a disposable local test account when no email is supplied,
then signs in with that account. To verify a pre-created hosted test account,
provide both values through the process environment:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_ANON_KEY = "<publishable or anon key>"
$env:EVIMESH_AUTH_TEST_EMAIL = "<test account email>"
$env:EVIMESH_AUTH_TEST_PASSWORD = "<test account password>"
pnpm auth:test:email
```

The script uses only the public/publishable key. Never use a service-role key
in a browser or commit any key or password.

After JWT verification, the domain layer provisions a stable human Actor and
provider Identity in one repository transaction. A repeat login for the same
provider/subject reuses the existing Actor; see
`packages/domain/src/actor-provisioning.mjs`.

## Browser session behavior

The Next.js app shares one browser Supabase client and mounts `AuthProvider`
on every route, including `/`. It restores saved sessions and consumes OAuth
and email-link callbacks before deciding whether navigation should show
`Sign in` or `Account`. Subsequent auth events update desktop and mobile
navigation. The SDK persists and refreshes the session; the legacy
`apps/web/src/auth.mjs` helper is not the Next.js app's session store.

Password sign-in and signup that returns a session go directly to `/home`.
A signup without a session stays on the form with email-confirmation
instructions. Email and OAuth redirects target `/home`; older callback links
to `/` still restore the session. Opening `/login` while signed in returns to
`/home`. These follow the SDK's [signup result](https://supabase.com/docs/reference/javascript/auth-signup)
and [auth-state events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

The browser regression suite uses intercepted auth/API responses and no real
accounts or email. From `apps/web`, start an isolated local server (POSIX shell):

```sh
NEXT_PUBLIC_SUPABASE_URL=https://auth.evimesh.test \
NEXT_PUBLIC_SUPABASE_ANON_KEY=evimesh-browser-test-key \
NEXT_PUBLIC_EVIMESH_API_URL=https://api.evimesh.test \
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3107
```

In a second terminal, also inside `apps/web`, run:

```sh
node --test e2e/auth-session.mjs
```

Install Playwright Chromium first, or set `CHROME_PATH` to an existing Chrome
executable. The suite covers password login, both signup outcomes, email and
OAuth callbacks, reloads, token refresh/expiry, invalid credentials, mobile
navigation, and cross-tab sign-out.

## Hosted project setup

For each Supabase environment, open the project's Auth settings:

- [Auth Providers](https://supabase.com/dashboard/project/_/auth/providers):
  enable Email provider and choose the project's email-confirmation policy.
- [URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration):
  set the environment's Site URL and add only the required redirect URLs.

The EviMesh hosted URL set is:

| Environment | Site URL | Additional redirect URL |
|---|---|---|
| development | `http://127.0.0.1:3000` | `http://127.0.0.1:3000/**` and `http://localhost:3000/**` |
| staging | `https://dev.evimesh.com` | `https://dev.evimesh.com/**` |
| production | `https://evimesh.com` | `https://evimesh.com/**` |

Use an explicit test account for hosted verification and keep its credentials
outside the repository. The acceptance condition for M4-01 is a successful
signup (or a known existing test account) followed by a successful password
login, as reported by `pnpm auth:test:email`.
