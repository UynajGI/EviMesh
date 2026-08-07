# M11 MCP Server

## Goal

Expose EviMesh research context and actions to any MCP-capable agent over stdio,
using research semantics only (no web UI, no GitHub concepts).

## Transport and protocol

`apps/mcp` ships a dependency-free newline-delimited JSON-RPC 2.0 stdio server
(`src/protocol.mjs`) and an MCP dispatcher (`src/server.mjs`). It negotiates
`initialize` against the supported protocol versions (2024-11-05, 2025-03-26,
2025-06-18), answers `ping`, and implements `resources/list`, `resources/read`,
`tools/list`, and `tools/call`. Unknown methods return `-32601`; malformed
frames return `-32700`/`-32600`.

## Authentication (M11-02)

`resolveConfig` reads `EVIMESH_API_URL` and `EVIMESH_API_TOKEN`. When the token
is absent it falls back to the limited token persisted by `sq auth login`
(`~/.evimesh/state.json`, `EVIMESH_CONFIG_DIR` override). The resulting SDK
client (`@evimesh/sdk-ts`) sends the token as a Bearer credential, which the
M10 API-token path in `api-edge` authenticates.

## Resources (M11-03..09)

Three static resources (`projects`, `questions/open`, `tasks/open`) plus five
URI templates (task context in the four modes, fixed claim revision, frontier
latest/sequence, actor contributions). `questions/open` filters to the
non-terminal states; frontier sequence reads resolve through the history page.

## Tools (M11-10..22)

Read-only: `search_open_tasks`, `get_task_context`, `validate_submission`,
`inspect_provenance`, `verify_inclusion_proof`.

Write tools, all gated by explicit consent: `start_attempt`, `record_trace`,
`create_claim`, `attach_evidence`, `record_run`, `publish_submission`,
`submit_verification`, `submit_challenge`. Draft producers (`create_claim`,
`record_run`) never touch the network. `attach_evidence` hashes the content and
uploads via the signed plan. The three publishing tools validate the document,
sign it with the shared `~/.evimesh` Ed25519 identity as a
`srp.client-signature-envelope.v1` envelope, then submit through the SDK.

## Safety (M11-23..25)

- Every write tool returns a `consent_required` structured error with a planned-
  action summary unless called with `confirm: true` (M11-23).
- Every tool declares an `inputSchema` and `outputSchema` and returns
  `structuredContent`, so outputs are machine-checkable (M11-24).
- `test/audit.test.mjs` asserts tool names, argument keys, and resource URIs
  contain no GitHub/PR/branch/commit semantics (M11-25).

## Boundary

The server only reaches the research network through the HTTP API via the SDK;
it never reads the database. M11-26 (npm alpha release) is gated on registry
credentials and is not part of this branch.
