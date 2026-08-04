# Hosted Infrastructure Readiness

Run:

```powershell
pnpm infra:hosted-readiness
pnpm infra:hosted-readiness --json
```

`PASS` means the local prerequisite is present. `PENDING` means an external
setup step remains; this command does not create projects, buckets, DNS
records, or secrets. Secret values are never displayed.

The readiness check covers the provider CLIs, Supabase and Cloudflare
configuration presence, and the three hosted origins required by M2-12/13.

## Windows CLI setup

Install the Supabase CLI through the official Scoop bucket:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

Wrangler is pinned in the `api-edge` and `web` workspace packages. Authenticate
only when provider access is intended; keep tokens out of the repository:

```powershell
supabase login
pnpm --filter @evimesh/api-edge exec wrangler login
```
