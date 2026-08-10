# M13.7-A08 Account, identity and credential contract

## Separate domains

| Domain | Purpose | Allowed data | Forbidden data / boundary |
| --- | --- | --- | --- |
| OAuth identities | Authenticate a person and prove provider ownership. | Provider, immutable provider subject, verification state, linked/last-authenticated timestamps, minimal encrypted provider data. | No editable public profile text as proof; no raw access/refresh token in public/profile data. `(provider, subject)` is unique. |
| Public profile | Represent the researcher publicly. | Display name, avatar, bio, affiliation, fields, verified-identity badges, and only opted-in links/contributions. | No email unless explicitly independently opted in; no auth metadata, security events, tokens, or private links. |
| Personal links | Let the person keep references that may be public or private. | URL, label, ownership and explicit visibility. | A typed ORCID URL/iD is never an OAuth identity or verified badge. |
| Credentials | Authorize CLI/MCP/SDK actions. | Token ID/prefix, label, scopes, resource limit, created/expiry/last-used/revoked state and one-time secret reveal. | Token values in profile, public page, URL, analytics, handoff, logs, browser persistent storage or audit payload. |
| Visibility/preferences | Control field-level profile sharing and notifications. | Per-field visibility and consent choices. | Visibility cannot override authorization or reveal credentials/identity internals. |
| Audit/security | Make sensitive actions accountable. | Actor, action, target opaque IDs, timestamp, result, reason/code and correlation ID. | Secret material, OAuth code, raw token, session/cookie, unnecessary personal content. |

## Verification and lifecycle rules

`verified ORCID` is possible only after a successful authorized ORCID OAuth/OIDC callback validates the provider subject and associates it with the current actor. Manual entry, URL paste, profile import, matching name, matching email, or an administrator display edit cannot create this state. Unlinking/relinking and resolving collisions require recent reauthentication, explicit confirmation, uniqueness enforcement, audit and a safe recovery path.

Public badges reveal only provider and verified/link state permitted by the profile owner. Account settings retains private identity metadata and credential management. Tokens are generated once, shown once, stored only as a verifier/secure secret representation, and revocable immediately; device/browser authorization is preferred for interactive MCP/CLI clients.

## Access boundaries

Profile visibility governs presentation only. Research and Agent access are enforced independently by the current authenticated actor, project authorization and resource scope. A shared permalink/handoff may carry immutable research context but never an identity secret or token. Missing, private, revoked, or collision-conflicted data gets a non-enumerating recovery response and an audit event.
