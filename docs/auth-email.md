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
