# Web UI

The Next.js web product lives in `apps/web` and is deployed through the
OpenNext Cloudflare Worker configuration in `apps/web/wrangler.jsonc`.

## Current UI surface (M13.8)

The app runs the task shell from the M13.8 design book
([`docs/design/`](design/README.md)): a top header with the primary
navigation Home / Explore / Work / Agent / Docs, global search, a manual
light/dark theme toggle, and a mobile drawer.

Product routes: the anonymous landing at `/`, the live-data Home at `/home`,
unified search at `/explore`, the action queue at `/work`, object pages for
Projects, Questions, Tasks, Claims, Artifacts, Runs, Evidence, Verification,
Challenges, Frontier details, Contributors, Attempts, and Event audit, plus
Account Settings, Notifications, and the six-view question workspace
(Summary / Current frontier / Argument / Evidence / Verification & challenges
/ Activity). `/docs` forwards to the canonical agent manual, served as
Markdown at `/agent.md`; `/agent` is the six-step connection center.
Complex writes open a handoff sheet instead of a form, and the command
palette (Ctrl+K or `/`) delegates object search to `/explore`.

The claim editor at `/claims/new` still supports browser-local IndexedDB
drafts, validated JSON/ZIP bundle export, and JSON/ZIP bundle import.

## Tests and build

Run the web suite with `node --test` inside `apps/web` (231 tests, including
the dual-theme token contrast gate) and build with
`node node_modules/next/dist/bin/next build`. Prefer these direct commands
over `pnpm build` / `pnpm test`, which trigger a pnpm dependency
re-verification and full reinstall that can stall on slow registry mirrors.

## Deployment boundary

Pull requests deploy a preview via `web-preview.yml`; pushes to `main` that
touch `apps/web` deploy the production Cloudflare Worker via
`web-production.yml` (`pnpm --filter @evimesh/web deploy:production`).
