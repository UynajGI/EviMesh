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
