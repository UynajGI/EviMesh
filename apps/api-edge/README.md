# @evimesh/api-edge

Cloudflare Workers API entrypoint built with Hono.

Routes currently include:

- `GET /health` — service status and environment marker.
- `GET /auth/me` — verifies an ES256 Supabase JWT and returns subject/email.

Every response receives an `X-Request-ID`. A valid incoming ID is preserved;
otherwise the Worker generates a UUID. API errors use the stable shape
`{ code, message, request_id }`.

Requests emit one structured JSON log containing method, path, status, request
ID, and duration. Authorization headers and request bodies are never logged.
JSON body validation uses the `safeParse` adapter in `src/validation.mjs` and
returns field paths in `issues` on `400 VALIDATION_ERROR` responses.

The API foundation also provides stable cursor pagination by createdAt and id,
revision ETags for If-Match checks, and an `Idempotency-Key` middleware. The
middleware replays the original HTTP response only when the same key is used
with the same request payload; reuse with a different payload returns `409`.
Project query services expose stable paginated lists and detail results that
include the current immutable revision.
Question queries add project/state filters and resolve the referenced Contract
revision alongside the current Question revision.

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
