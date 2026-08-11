# M13.7-A01 Production UX audit

## Scope and evidence policy

- Audit date: 2026-08-10.
- Target: `https://evimesh.com`.
- Method: anonymous Chromium session through Playwright CLI, inspected at 1440 × 1000 and 390 × 844.
- Evidence is limited to what the anonymous session could observe. No account was created, no credentials were entered, and no authenticated or real-data result is inferred from anonymous routes.
- Local snapshots are retained in the operator worktree under `.playwright-cli/`; they are not committed because they are generated browser artifacts. The route, viewport and textual snapshot below are sufficient to reproduce each observation.

## Coverage matrix

| ID | Route | State | Viewport | Screenshot / observation | Severity | Finding | Recommendation input |
|---|---|---|---|---|---|---|---|
| A01-01 | `/` | anonymous, empty data | 1440 × 1000 | Playwright snapshot `page-2026-08-10T03-21-34-758Z.yml` | High | The primary navigation is the raw object list `Projects`, `Questions`, `Tasks`, `Claims`, `Verification`, `Events`. The main content is four empty collections. A first-time researcher has no path to understand the research model, find a real example, sign in, or connect an Agent. | Replace the first-level object list with task navigation: Home, Explore, Work, Agent and Docs. Make the anonymous page a short product explanation with an identified public research example and two clear paths: explore research and connect an Agent. |
| A01-02 | `/` | anonymous, empty data | 1440 × 1000 | Same snapshot; all four collection regions report no content | High | The empty state explains that content will appear later, but provides no recovery action, sample, search, sign-in or onboarding route. | Every key empty state must provide one valid next action and distinguish unavailable data from a genuinely empty research network. |
| A01-03 | `/` | anonymous, mobile navigation | 390 × 844 | Playwright snapshot `page-2026-08-10T03-23-29-540Z.yml` | Medium | Mobile correctly collapses the header to a menu toggle, but the resulting menu still exposes database-object navigation rather than a researcher task model. | Preserve the responsive control, replace its information architecture, and give mobile access to account, search and Agent connection. |
| A01-04 | `/sign-in` | anonymous | 1440 × 1000 | Playwright snapshot `page-2026-08-10T03-22-07-563Z.yml` | High | Email/password and `Continue with GitHub` are available, but no ORCID identity path is present. The page has no visible account or sign-in entry in the global header, so discovery depends on reaching this URL indirectly. | Build one sign-in hub with ORCID, GitHub and Email paths, capability/privacy copy, return handling, failures and an explicit global sign-in action. |
| A01-05 | `/settings` | anonymous route | 1440 × 1000 | Playwright snapshot `page-2026-08-10T03-22-34-944Z.yml` | Critical | The profile form is rendered but reports `Supabase public configuration is unavailable`. It supports only display name, avatar URL and bio; there is no identity, affiliation, research-field, visibility or security navigation. | Fail builds/deploys when required public Auth configuration is absent. Add an authenticated Account Settings shell with Profile, Connected identities, Tokens, Security and Notifications. |
| A01-06 | `/settings/tokens` | anonymous route | 1440 × 1000 | Playwright snapshot `page-2026-08-10T03-22-44-131Z.yml` | Critical | The token route exists but is not discoverable from Header or Settings. It reports the same configuration failure and exposes raw scopes such as `profile:read`, not human purpose, resource scope, expiry or last-use concepts. | Make Tokens reachable from Account and Agent. Prefer device/browser authorization for first-time CLI/MCP users; retain named, expiring, least-privilege tokens as an advanced path with one-time reveal and revocation. |
| A01-07 | `/agent` | anonymous | 390 × 844 | Playwright snapshot `page-2026-08-10T03-23-53-929Z.yml`; HTTP 404 | Critical | There is no Agent, MCP, CLI or reading-use entry point. The mobile 404 page only returns to the brand root. | Add `/agent` as a connection centre with MCP, CLI, SDK, first-read verification and security guidance. Provide client-specific configuration cards without embedding secrets. |
| A01-08 | all observed pages | anonymous | 1440 × 1000 and 390 × 844 | Playwright console output, 2026-08-10 | Low | Every observed route requested a missing `/favicon.ico` and produced a 404 console error. | Add a valid favicon and include it in the production visual/console smoke test. |
| A01-09 | authenticated Home, Work, profile, identity linking and token lifecycle | not observed | n/a | Explicit blocker: audit had no consented EviMesh test account or sanctioned auth test state. | Blocked | No conclusion is drawn about signed-in content, account linking, token creation, error recovery or personal data visibility. | Before M13.7-F, repeat the matrix with a disposable, consented test account and documented cleanup. Do not use a real researcher account. |
| A01-10 | loading, network error and permission-denied states | not observed | n/a | Explicit blocker: no safe production fault-injection authorization. | Blocked | Production error-state behavior cannot be truthfully evaluated by this audit. | Validate deterministic loading/error/denied fixtures in M13.7-C and production canary smoke tests in M13.7-F. |

## Cross-cutting findings

1. The most important usability failure is information architecture, not visual polish: the site asks researchers to learn internal object taxonomy before they can discover, understand, contribute or connect an Agent.
2. Current pages contain real capability seeds: GitHub OAuth and API-token routes exist. M13.7 must make them visible, coherent and production-configured rather than recreate them blindly.
3. ORCID must be an authenticated scholarly identity, not a manually editable profile string.
4. The `Supabase public configuration is unavailable` alert is a production release blocker for the entire identity and token story.
5. The Agent connection path is absent, so Web cannot yet hand a researcher safely from a reading context to CLI or MCP.

## Contract inputs for M13.7-A02 through A08

- Freeze task-based first-level navigation and move object types into Explore filters and research-workspace context.
- Require a public/example path for anonymous users and a Watchlist/Work path for signed-in users.
- Treat public configuration validation as a release contract, not a user-facing runtime recovery state.
- Separate authenticated identities, public profile fields, personal links and credentials in the account contract.
- Define Agent connection as a product flow with client selection, least privilege, test connection and revocation.

## Reproduction commands

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli --session m137a-audit open https://evimesh.com --browser chrome
npx.cmd --yes --package @playwright/cli playwright-cli --session m137a-audit resize 1440 1000
npx.cmd --yes --package @playwright/cli playwright-cli --session m137a-audit snapshot
npx.cmd --yes --package @playwright/cli playwright-cli --session m137a-audit goto https://evimesh.com/sign-in
npx.cmd --yes --package @playwright/cli playwright-cli --session m137a-audit snapshot
npx.cmd --yes --package @playwright/cli playwright-cli --session m137a-audit goto https://evimesh.com/settings/tokens
npx.cmd --yes --package @playwright/cli playwright-cli --session m137a-audit snapshot
```
