# @evimesh/api-edge

Cloudflare Workers API entrypoint built with Hono.

Routes currently include:

- `GET /health` — service status and environment marker.
- `GET /auth/me` — verifies an ES256 Supabase JWT and returns subject/email.

Every response receives an `X-Request-ID`. A valid incoming ID is preserved;
otherwise the Worker generates a UUID. API errors use the stable shape
`{ code, message, request_id }`.

Configure `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`, and optionally
`SUPABASE_JWT_AUDIENCE` as Worker variables. Do not commit a JWKS, API token,
or runtime secret; keep local secrets in `.dev.vars` or Cloudflare's secret
store.

Run tests and the Worker locally with:

```powershell
pnpm --filter @evimesh/api-edge test
pnpm --filter @evimesh/api-edge dev
```

Staging and production deployments are explicit Wrangler commands:

```powershell
pnpm --filter @evimesh/api-edge deploy:staging
pnpm --filter @evimesh/api-edge deploy:production
```
