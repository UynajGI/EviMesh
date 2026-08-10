# M13.7-A04 Global product IA

## Top-level contract

| Destination | One primary responsibility | Entry and boundary |
| --- | --- | --- |
| Home | Personal awareness of followed research and my current activity. | Signed-in default; watchlist, changes, recent research and agent status. It is not global search or a task queue. |
| Explore | Discover and understand public/permitted research. | Global search and filters for questions, projects, topics and people; object types remain filters/results, not top-level destinations. |
| Work | Act on research work assigned to or created by me. | Tasks, verification queue, challenges, drafts and contribution history. It is not a watchlist. |
| Agent | Connect and operate a client safely. | MCP, CLI, SDK, read guide, connection tests and security/revocation. It is not the account token inventory. |
| Docs | Learn product, protocol and integration concepts. | Guides and references; it does not hold live connection state. |
| Account | Manage the person, authentication and private preferences. | Profile, identities, tokens, security and notifications. It is not a public profile. |

The global header contains brand/Home, Explore/search, Work, Agent, Docs and Sign in or Account. Mobile exposes the same destinations. A local sidebar or URL-backed tabs may refine one destination only: Explore filters, research workspace views, Agent sections, or Account settings.

## Hierarchy

`Global shell -> top-level destination -> contextual index/sidebar -> page -> research/work item.`

Research objects are reached from Explore, Work, Home activity, or a stable permalink. They retain M13.6 immutable ID/revision/snapshot semantics and never become an additional first-level IA.
