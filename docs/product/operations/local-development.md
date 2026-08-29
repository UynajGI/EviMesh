---
title: Local development
description: Get the full EviMesh workspace running locally - infrastructure, demo data, tests, and the verification gates that keep it honest.
audience: operator
status: current
sourceOfTruth: AGENTS.md
updatedAt: 2026-08-29
---

# Local development

## Prerequisites

- Node 22 and pnpm 11 (the workspace pins pnpm via `packageManager`/CI)
- Docker Desktop (for the local infrastructure services)
- A machine that can run the Next.js build (16 GB RAM is comfortable)

## Workspace setup

```bash
pnpm install
pnpm infra:up        # postgres + minio + mailpit via Docker Compose
pnpm lint            # package manifest checks (18 packages)
```

## Run the product

Two supported paths:

- **With the demo API** (no database, no credentials): `pnpm demo:api` in one
  terminal and `pnpm demo:web` in another, then open
  `http://localhost:3000`. The demo stack is the real api-edge worker over
  an in-memory PostgREST simulator seeded with a small protocol story.
- **Against hosted services**: configure the Supabase/Cloudflare
  environment as described in the hosted readiness runbook
  (`docs/hosted-readiness.md`) and deploy or preview as usual.

## Testing

```bash
node --test                        # in apps/web - web suite, direct node
pnpm --filter @evimesh/protocol test   # package-scoped suites are fine via pnpm
pnpm docs:reference:check          # generated docs reference is current
node scripts/visual-capture.mjs    # docs baseline screenshots (demo stack up)
```

## The pnpm trap

Never run the web app's tests or build through `pnpm --filter @evimesh/web
test`/`build`: pnpm re-verifies dependencies and reinstalls, which stalls on
slow registry mirrors. Run them directly:

```bash
cd apps/web
node --test
node node_modules/next/dist/bin/next build
```

## Frontiers of this document

Deployment, secrets, key rotation, and incident response live in their own
runbooks under `docs/runbooks/` and `docs/infra-*.md` - this page stops at
the local boundary.
