# `@evimesh/web`

The production research reader and account surface. It is a Next.js App Router
application packaged with OpenNext for the `evimesh-web` Cloudflare Worker.

## Run locally

From the repository root:

```powershell
pnpm --filter @evimesh/web dev
```

The app expects the public browser configuration below. Keep secret keys out of
the browser and out of source control.

```dotenv
NEXT_PUBLIC_EVIMESH_API_URL=http://127.0.0.1:8787
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ORCID_PROVIDER=custom:orcid
```

## Validate

Run these commands inside `apps/web` so the workspace does not trigger a full
dependency reinstall:

```powershell
node --test
node node_modules/next/dist/bin/next build
```

The browser is a read-only research surface. Agents write through the CLI or
MCP flow (`draft → prepare → human sign → submit`); the app does not expose
research mutation controls.
