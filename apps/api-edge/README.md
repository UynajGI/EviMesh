# @evimesh/api-edge

## M2-07 Cloudflare Workers

This package is the minimal Cloudflare Workers edge entrypoint. It currently
exposes `GET /health` and returns a JSON service status; business routes are
deferred to later milestones.

Run the local contract test with:

```powershell
pnpm --filter @evimesh/api-edge test
```

Run the Worker locally after installing Wrangler and authenticating with the
target Cloudflare account:

```powershell
pnpm --filter @evimesh/api-edge dev
pnpm --filter @evimesh/api-edge deploy:dev
```

The configuration deliberately contains no account ID, API token, or runtime
secret. Keep local secrets in `.dev.vars` or the environment-specific secret
store; never commit them.

面向外部入口的边缘 API 适配层。当前为骨架包。
