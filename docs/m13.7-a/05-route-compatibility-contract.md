# M13.7-A05 Route compatibility contract

## Policy

Canonical means the stable, shareable URL for a resource. Existing links remain valid through **retain**, **redirect**, or **contextual redirect**; no redirect may drop an immutable revision, snapshot, visibility check, or permitted M13.6 context parameter. Authorization occurs before contextual restoration. URLs never contain a token, secret, session, email, or profile-private value.

| Existing route family | Decision | Canonical destination / behavior |
| --- | --- | --- |
| `/` | retain | Anonymous landing; signed-in Home. `/home` may redirect to `/`. |
| `/projects`, `/questions`, `/claims`, `/contributions`, `/events`, `/verification` | retain | Object indexes remain valid and canonical until an explicitly shipped migration; header no longer promotes them. Add contextual links into Explore results. |
| `/projects/{id}`, `/questions/{id}`, `/claims/{id}`, `/tasks/{id}`, `/artifacts/{id}` | retain | Preserve existing stable object paths and M13.6 revision/snapshot requirements. Breadcrumb begins Explore or Work only when that is actual parent context. |
| `/projects/{id}/frontier/{snapshotId}`, claim revision/diff and all M13.6 permalink forms | retain | Immutable canonical paths; preserve allowed `view`, `sel`, `expand`, `rel`, `filter`, and `as_of` context. |
| `/tasks`, `/claims/new`, `/challenges/new`, `/evidence/new`, `/runs/new`, `/verification/receipt/new`, `/artifacts/upload` | contextual redirect | Keep URL/action; after completion return to Work or originating permitted research context. |
| `/settings` | redirect | `/account/profile` after Account shell ships; preserve it until then. |
| `/settings/tokens`, `/settings/keys` | redirect | `/account/tokens`; require authentication and never carry a credential in redirect state. |
| `/sign-in` | retain | Canonical sign-in hub; validated return target only. |
| `/onboarding` | contextual redirect | `/agent` or `/docs/getting-started` according to the selected safe flow. |
| `/design`, `/prototypes/m13-6-a` | retain | Internal/prototype routes retain their current explicit non-product context; never advertise as product destinations. |
| future `/agent` | canonical | Connection centre; `/agent/read`, `/agent/mcp`, `/agent/cli`, `/agent/sdk`, `/agent/security` are child routes. |
| future public researcher profile | canonical | `/people/{actorId}` (or the existing `/contributors/{actorId}` only until a shipped redirect); public visibility is enforced server-side. |

## Breadcrumb policy

Use breadcrumbs for a genuine hierarchy deeper than one contextual level, e.g. `Explore / Question / [title]` or `Account / Tokens`. Do not manufacture a breadcrumb from a search query, private work queue, or referrer. A direct permalink shows its object type and stable identifier context; it must not claim an unavailable parent. Tabs that change route use URL-backed navigation; in-page view changes use accessible tab panels.
