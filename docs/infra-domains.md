# EviMesh Runtime Domains

Domain values are deployment inputs, not source-code constants. Configure the
actual zone names only after the Cloudflare zone and Pages/Workers projects
exist.

## Required endpoints

| Variable | Purpose | Example placeholder |
|---|---|---|
| `EVIMESH_WEB_DEV_ORIGIN` | Development Web origin | `https://dev.example.invalid` |
| `EVIMESH_WEB_PRODUCTION_ORIGIN` | Production Web origin | `https://example.invalid` |
| `EVIMESH_API_PRODUCTION_ORIGIN` | Production API origin | `https://api.example.invalid` |

The `.invalid` examples are documentation-only and must not be used for a
deployment. M2-12 and M2-13 are complete only after DNS records, HTTPS
certificates, and the `/health` endpoint have been verified from outside the
local machine.

## Required platform setup

1. Create or select the authoritative Cloudflare zone.
2. Point the development Web hostname to `evimesh-web-dev` and the API
   hostname to the production Worker `evimesh-api-edge`.
3. Store the resolved origins in the environment-specific deployment system.
4. Verify HTTPS and record the external `/health` response in the deployment
   report.

Do not commit zone IDs, tokens, or provider-generated secrets.

## Current Cloudflare resources

The initial Cloudflare resources are provisioned as follows:

| Environment | Worker | Pages project |
|---|---|---|
| development | `evimesh-api-edge-dev` | `evimesh-web-dev` |
| staging | `evimesh-api-edge-staging` | — |
| production | `evimesh-api-edge` | `evimesh-web` |

The development Pages preview is deployed from the infrastructure branch. The
Workers and Pages provider URLs are deployment outputs, not custom-domain
contracts; record them in release notes rather than hard-coding them here.

## Configured custom domains

| Hostname | Target | Status |
|---|---|---|
| `dev.evimesh.com` | `evimesh-web-dev` Pages | active |
| `evimesh.com` | `evimesh-web` Pages | active |
| `api.evimesh.com` | `evimesh-api-edge` Worker | HTTPS `/health` verified |

## R2 buckets

| Environment | Bucket | CORS origin |
|---|---|---|
| development | `evimesh-dev` | `https://dev.evimesh.com` |
| staging | `evimesh-staging` | not configured |
| production | `evimesh-production` | `https://evimesh.com` |
