# M13.7-A07 ADR: ORCID and Supabase spike

**Status: BLOCKED — no sandbox proof exists.** No OAuth request, callback, token exchange, account-linking attempt, or production credential use was performed for this ADR.

## Safe evidence observed (2026-08-10)

| Check | Observation | Conclusion |
| --- | --- | --- |
| ORCID sandbox variables | `ORCID_SANDBOX_CLIENT_ID` and `ORCID_SANDBOX_CLIENT_SECRET` were absent; no local env file was present. | No authorized Sandbox client is available. |
| Supabase test variables | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were absent. | No authorized hosted test project/configuration is available. |
| Repository template | `.env.example` declares empty Supabase placeholders only. | Template is not a configured test environment. |
| A01 production audit | The public site reported Supabase public configuration unavailable. | It is not evidence for OAuth, linking, collision, or missing-email behavior. |

The read-only readiness command found tooling but not Supabase configuration. It did not expose or use any secret. A configured Cloudflare token was deliberately out of scope and unused.

## Deployable choice (pending proof)

Use Supabase Auth as the session authority and register ORCID only through an authorized non-production OIDC/OAuth configuration. Model the ORCID provider subject separately from profile data; enforce one `(provider, subject)` per EviMesh actor; require recent authentication and explicit confirmation before linking/unlinking; write every identity-security operation to audit. Do not enable email-based automatic linking for ORCID as a substitute for this confirmation.

This choice is deployable only after the safe protocol below passes. If Supabase cannot support the required ORCID configuration and callback constraints in the authorized test project, implement an EviMesh-owned callback/external-identity service with the same uniqueness, audit, encryption and reauthentication requirements; record a superseding ADR.

## Explicitly unproven / blocked

Live OAuth callback, token exchange, local-account linking, duplicate-subject collision, callback error recovery, and missing-email handling are **blocked**. This ADR makes no pass claim for any of them.

## Concrete safe execution protocol

1. Obtain written authorization for a disposable ORCID Sandbox client and isolated Supabase test project; use HTTPS test redirect URIs and separately named test accounts only.
2. Put client secret/access token only in ignored local secret storage or the approved test-secret manager; verify commands redact values. Never use production URLs, researchers, tokens, or logs.
3. Test sign-in callback with a disposable ORCID Sandbox record; record provider, subject hash, timestamps, redirect allowlist result and outcome—never authorization code/access token.
4. From a recently authenticated disposable EviMesh account, test explicit link and unlink; verify a second account cannot claim the same ORCID subject and receives a safe collision/recovery response.
5. Test an ORCID response without usable email using a controlled fixture/approved sandbox path: require verified local email or another approved recovery path; do not synthesize an email or merge accounts.
6. Verify audit events, one-time secret handling, RLS/authorization and cleanup; revoke sandbox grants/tokens and delete disposable accounts. Attach redacted evidence to the follow-on implementation packet.

Official requirements: [ORCID minimum integration requirements](https://info.orcid.org/documentation/integration-guide/minimum-requirements-for-member-integrations/) and [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking). Retrieved 2026-08-10.
