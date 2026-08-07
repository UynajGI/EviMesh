# M10 SDK and CLI

## API surface for programmatic access

M10 exposes the research API surface that the SDK and CLI build on. The
Cloudflare Worker (`apps/api-edge`) now wires the previously query-only and
command-only modules into HTTP routes for Artifacts, Evidence, Runs,
Challenges, Attempts, Contributions, Verifications, Events (with NDJSON
export, inclusion proofs, and checkpoints), MergeProposals, provenance, and
Frontier diffs, alongside the authenticated write routes for Tasks, Claims,
Evidence, Runs, Artifacts, Verifications, and Challenges. It also implements
the RFC-8628 device authorization grant (`/auth/device`,
`/auth/device/approve`, `/auth/device/token`) backing `sq auth login`; the
exchange issues only the limited CLI scopes. Pending device codes live in an
in-process store by default; multi-instance deployments inject a shared
`deviceCodeStore`. Detail responses for Projects, Tasks, Claims, and
Challenges carry an `etag` used for `If-Match` revision guards. The full
contract is versioned in `apps/api-edge/openapi.json` and pinned by
`test/openapi-contract.test.mjs`, which asserts every operation ID and that
all writes except the signed upload plan and the public device start/poll
endpoints require bearer auth.

## @evimesh/sdk-ts

The SDK is a dependency-free ESM client. `createClient({ baseUrl, token |
tokenProvider, fetchImpl })` returns resource clients for `projects`,
`questions`, `tasks`, `attempts`, `claims`, `artifacts`, `runs`, `evidence`,
`verifications`, `challenges`, `frontier`, `events`, and `contributions`.

Behavioral guarantees:

- Writes carry an `Idempotency-Key` by default (`idempotencyKey` overrides or
  disables per call).
- Non-2xx responses raise typed errors (`EviMeshAuthenticationError`,
  `EviMeshNotFoundError`, `EviMeshConflictError`, `EviMeshPreconditionError`,
  `EviMeshUnavailableError`, …) with `code`, `status`, and `requestId`.
- `paginate` and per-resource `listAll` async iterators walk cursor pages.
- `artifacts.uploadPlan` + `artifacts.upload` perform signed direct uploads.
- `events.proof` + `verifyEventProof` fetch and locally verify Merkle
  inclusion proofs (optionally against a supplied Event).

TypeScript declarations are generated from the OpenAPI document:
`node scripts/generate-types.mjs` writes `src/generated/types.d.ts`;
`pnpm --filter @evimesh/sdk-ts test` reruns the generator in `--check` mode
and compiles the output plus `test/types-smoke.ts` with `tsc --noEmit`.

## @evimesh/cli (`sq`)

The CLI builds on the SDK. Command groups:

- Setup: `config init`, `auth login` (device flow or `--token`), `identity
  generate` (Ed25519 + did:key).
- Reads: `project list`, `question list`, `task list`, `task inspect`,
  `provenance`.
- Research loop: `context pull` (downloads and hash-verifies a ContextBundle),
  `attempt start` (local workspace + remote Attempt), `claim create` /
  `run record` templates, `evidence add` (SHA-256 + signed direct upload),
  `validate`, `submit` (canonical signing + submission), `challenge create`,
  `verify checkout` (locks a ClaimRevision, prepares signing bytes, and pulls
  the Blind Context), `verify submit`, `bundle verify` (offline hash,
  signature, and proof verification).

Cross-cutting rules: every command supports `--json` (stable machine output);
every write command supports `--dry-run` (prints the canonical payload and
signing digest without any network call); `auth login` only persists the
limited `profile:read`/`project:read` scopes. Local protocol validation uses
the shared subset validator in `@evimesh/schemas`
(`packages/schemas/src/validator.mjs`).

Configuration lives in `~/.evimesh` (`config.json`, `state.json`), overridable
via `EVIMESH_CONFIG_DIR` for tests.

## Boundary

SDK and CLI target the HTTP contract only; neither reads the database nor
depends on GitHub. The npm release tasks (M10-41/42) remain gated on registry
credentials and are not part of this branch.
