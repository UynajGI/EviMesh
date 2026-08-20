# AGENTS.md — EviMesh working rules

Open distributed research network. Protocol-heavy monorepo: `apps/*` (web,
api-edge, mcp, worker), `packages/*` (protocol, database, sdk, cli, ...).
Milestones M1-M13 are complete; see `README.md` for the module map.

## Commands

```powershell
pnpm install
pnpm lint
# web tests and build: run DIRECTLY inside apps/web (see trap below)
cd apps/web; node --test
cd apps/web; node node_modules/next/dist/bin/next build
pnpm --filter @evimesh/protocol test   # package-scoped tests are fine via pnpm
pnpm infra:up                          # postgres + minio + mailpit (Docker)
```

**Trap: do not use `pnpm build` / `pnpm test` for the web app.** They trigger
pnpm's dependency re-verification and a full reinstall, which stalls on slow
registry mirrors. Use the direct `node` commands above.

## Hard boundaries

- **No scores.** Never render evidence counts as percentages, progress bars,
  truth/support scores, likes, or rankings. Counts are navigation entry
  points only (design book `docs/design/02-color-language.md`).
- **The Claim graph is a DAG** of 14 typed directed edges, never a
  parent-child tree; graph views must ship a keyboard-reachable list view.
  The graph uses d3-dag Sugiyama layout + React Flow (design book 00 §5.3);
  do not reintroduce cytoscape.
- **Agents never impersonate humans.** Every agent-produced item carries its
  attribution chain; agents draft, humans sign.
- **Single UI system.** Web styling follows the M13.8 tokens in
  `apps/web/app/globals.css` (dual-tier status colors, `data-theme` dark
  override). Do not add a second component library or raw colors.
- **ORCID is OAuth-verified only.** A manually typed iD can never render as
  verified.

## Source-of-truth pointers

| Topic | Where |
|---|---|
| UI design language, page specs, mockups | `docs/design/` (start at its README) |
| API contract | `apps/api-edge/openapi.json` |
| List endpoints don't carry relations | evidence links live on `/evidence/:id` (`claimLinks`), receipt findings on `/verifications/:receiptId`; hydrate via `apps/web/lib/hydrate.mjs` |
| Frontier members | only `/projects/:id/frontier/history` hydrates members; `latest` does not, and history pages are ASCENDING |
| Protocol UX map / lexicon | `docs/m13.6-a/` |
| Deployment | `.github/workflows/web-production.yml` (main + apps/web paths -> Cloudflare Worker) |

## Review bots (GitHub PRs)

- Sourcery: comment `/review` on the PR; it skips diffs > 150k characters.
- Codex: comment `@codex review`; verify its API claims against source before
  acting (it re-flags already-fixed lines it cannot data-flow trace).
