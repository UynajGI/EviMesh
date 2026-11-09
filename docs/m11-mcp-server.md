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

The current server always exposes typed graph inspection plus local draft and
validation tools. It discovers `GET /meta/capabilities` through the SDK before
each tool listing. Typed prepare appears only with `research.prepare=true` and
returns server-issued canonical signing bytes/hash for human review; it does
not sign. Typed submit appears only with `research.submit=true`, accepts only an
externally supplied `srp.client-signature-envelope.v1`, and relays it after
explicit network consent. Fetch or schema failure uses the conservative
fallback and advertises neither operation; `tools/call` repeats the same check.

`start_attempt`, `record_trace`, `attach_evidence`, `record_run`, and the legacy
prepare/publish/verification/challenge relay tools remain unadvertised and
fail-closed on direct calls until their types expose canonical server prepare
plus externally signed submit flows. `create_claim` creates an attributed
local Agent draft only.

## Safety (M11-23..25)

- Every advertised network-write tool returns a `consent_required` structured
  error with a planned-action summary unless called with `confirm: true`
  (M11-23). Hidden legacy tools fail before consent and never reach a network
  mutation.
- `confirm: true` only authorizes the described network mutation. It cannot
  create, replace, or bypass a human signature envelope.
- MCP contains no signer, no human private-key access or storage, no
  `research:sign` scope, and no general shell/command-execution tool. Human
  signing is exclusively the interactive local CLI command `sq research sign`;
  the private key never enters the MCP process.
- Every tool declares an `inputSchema` and `outputSchema` and returns
  `structuredContent`, so outputs are machine-checkable (M11-24).
- `test/audit.test.mjs` asserts tool names, argument keys, and resource URIs
  contain no GitHub/PR/branch/commit semantics (M11-25).

## Distribution and boundary

The server only reaches the research network through the HTTP API via the SDK;
it never reads the database. `@evimesh/mcp` is built as a self-contained Node
22+ npm artifact with the `evimesh-mcp` executable. After publication, register
`npx --yes @evimesh/mcp` as a stdio server. From the repository root,
`pnpm package:test` builds both npm artifacts, installs their packed tarballs
into clean temporary directories, and initializes the installed MCP server.
Registry credentials are still required to publish the M11-26 release.
