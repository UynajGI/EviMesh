# @evimesh/status

Public, read-only service health for EviMesh.

The Worker probes the public Web and API endpoints. The API dependency probe
supplies Database, Object Storage, and Authentication health without exposing
credentials, provider responses, or user data. A scheduled trigger records the
latest snapshot and status transitions in a strongly consistent SQLite Durable
Object. No user or research data enters this store.

```powershell
pnpm --filter @evimesh/status test
pnpm --filter @evimesh/status dev
```

Production is served from `https://status.evimesh.com`. Deployment requires the
production Cloudflare environment approval and repository credentials; the page
must never show a hard-coded healthy state.

`deploy:workers-dev` is a non-canonical fallback for validating the same Worker
when a deployment token cannot edit zone routes. It does not satisfy the
`status.evimesh.com` release gate.
