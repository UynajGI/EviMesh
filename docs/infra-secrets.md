# EviMesh Infrastructure Secrets

This document defines environment names and their separation across
development, staging, and production. Real values belong in the hosting
platform or a local ignored `.env` file; they must never be committed.

## Naming rules

- Use the same variable name in every environment.
- Keep environment selection in `EVIMESH_ENV`; do not encode it in secret names.
- Public client configuration uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Server-only credentials use `SUPABASE_SERVICE_ROLE_KEY`,
  `R2_SECRET_ACCESS_KEY`, and `CLOUDFLARE_API_TOKEN`.
- Never place service-role, R2 secret, or Cloudflare token values in browser code.

## Environment matrix

| Environment | Supabase | Object storage | Runtime policy |
|---|---|---|---|
| development | Development project | MinIO or R2 development bucket | Local `.env`, disposable data |
| staging | Staging project | R2 staging bucket | Platform-managed secrets |
| production | Production project | R2 production bucket | Platform-managed secrets, no public defaults |

## Variables

| Variable | Scope | Required | Secret |
|---|---|---:|---:|
| `DATABASE_URL` | server | yes | yes |
| `S3_ENDPOINT` / `R2_ENDPOINT` | server | yes | no |
| `S3_ACCESS_KEY_ID` / `R2_ACCESS_KEY_ID` | server | yes | no |
| `S3_SECRET_ACCESS_KEY` / `R2_SECRET_ACCESS_KEY` | server | yes | yes |
| `SUPABASE_URL` | client/server | hosted only | no |
| `SUPABASE_ANON_KEY` | client/server | hosted only | no |
| `SUPABASE_SERVICE_ROLE_KEY` | server | hosted only | yes |
| `CLOUDFLARE_ACCOUNT_ID` | deployment | hosted only | no |
| `CLOUDFLARE_API_TOKEN` | deployment | hosted only | yes |

Copy `.env.example` to `.env` for local work, then replace only the values
needed by the selected environment. The repository ignores `.env` and other
`.env.*` files by default.
