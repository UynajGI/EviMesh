# Web UI

The Next.js web product lives in `apps/web` and is deployed through the
OpenNext Cloudflare Worker configuration in `apps/web/wrangler.jsonc`.

## Current M9 UI surface

The web app includes product routes for Projects, Questions, Tasks, Claims,
Artifacts, Runs, Evidence, Verification, Challenges, Frontier details,
Contributors, and Event audit. The Claim editor at `/claims/new` supports
browser-local IndexedDB drafts, validated JSON/ZIP Bundle export, and JSON/ZIP
Bundle import.

The Claim editor was checked in a real browser at 375px and 1440px wide. The
responsive regression and basic accessibility checks are in
`apps/web/test/next-app.test.mjs`.

## Deployment boundary

The UI changes are currently on the feature branch and are not visible at
`https://evimesh.com` until the M9 Part is reviewed, merged, and the production
workflow completes. A raw unstyled sign-in page at the domain indicates the
previous static deployment, not that the UI source is missing.

The server routes those M9 pages render against were implemented in
`apps/api-edge` during M10 (see [`docs/m10-sdk-cli.md`](docs/m10-sdk-cli.md));
they become end-to-end live once the Worker is redeployed. The UI build, test
suite, and lint checks remain independent of those hosted data dependencies.
