# M13.7-A02 Official pattern benchmark

Retrieved: 2026-08-10. Conclusions below are constrained to the linked official sources; they are product decisions, not claims that EviMesh already implements them.

| Area | Official source URL | Requirement extracted | EviMesh decision |
| --- | --- | --- | --- |
| Navigation | [Primer navigation](https://primer.style/product/ui-patterns/navigation/) | Make location and next destinations clear; use breadcrumbs/back links for parent-child navigation; place navigation near the content it changes. | Use six task destinations, contextual side navigation, and breadcrumbs only for real hierarchy. |
| Design system | [Primer components](https://primer.style/product/components/) | Reusable components provide consistent accessible interactions; NavList and PageHeader cover application navigation and page hierarchy. | Adopt Primer React through an EviMesh-only adapter boundary; do not copy GitHub brand or repository concepts. |
| ORCID sign-in | [ORCID OAuth sign-in guidelines](https://info.orcid.org/documentation/integration-guide/orcid-oauth-sign-in-guidelines/) | Explain ORCID and support both sign-in and local-account linking through OAuth. | Present ORCID as scholarly identity sign-in/linking, with consent-purpose copy and recovery paths. |
| ORCID verification | [ORCID minimum requirements](https://info.orcid.org/documentation/integration-guide/minimum-requirements-for-member-integrations/) | Collect authenticated iDs using OAuth; do not allow search or manual iD entry; use HTTPS redirects and display rules. | Only a successful OAuth/OIDC callback with a validated subject may create `verified`; manual text is a personal link, never verified identity. |
| Supabase identity | [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) | Identity linking can be automatic or manual; automatic linking is email-based and manual OAuth linking must be explicitly enabled. | Do not rely on same-email auto-linking for ORCID. Require a recently authenticated account, explicit confirmation, unique provider-subject collision handling, and audit. |
| MCP connection | [MCP remote-server connection](https://modelcontextprotocol.io/docs/develop/connect-remote-servers) | Remote connections require an explicit server endpoint and an authentication strategy appropriate to the client. | `/agent` is a connection centre: choose client, authorize least privilege, configure, test a read, and revoke. Tokens never appear in examples or URLs. |
| Token safety | [GitHub token management](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) | Treat tokens as passwords and prefer a more secure authentication mechanism when available. | Browser/device authorization is the default; named, expiring, least-privilege personal tokens are advanced, one-time-reveal credentials. |

## Benchmark conclusion

The coherent pattern is a small task-oriented shell, contextual navigation for a current workspace, explicit identity linking, and credentials separated from profiles. The A04-A08 contracts freeze that pattern. No benchmark source authorizes exposing token values, inferring an ORCID identity from profile text, or converting protocol object types into global navigation.
