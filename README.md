# EviMesh

EviMesh 是开放分布式科研推进网络项目。

当前项目文档：

- [Roadmap](EviMesh_Roadmap_v0.3.md)
- [Task](EviMesh_Task_v0.3.md)

## 本地环境

本仓库使用 Git、Lefthook 和 CodeGraph 维护基础工程质量。具体开发语言和运行时将在实现阶段按模块补充。

## 常用命令

```powershell
lefthook install
codegraph status
pnpm install
pnpm lint
pnpm --filter @evimesh/protocol test
pnpm infra:up
pnpm infra:doctor
docker compose up -d postgres
docker compose up -d minio
docker compose up -d mailpit
docker compose ps
```

## Local PostgreSQL

M2-18 provides a local PostgreSQL 16 service through `compose.yaml`. It uses
the development-only database `evimesh_dev`, the user `evimesh`, and a named
Docker volume. Set `EVIMESH_POSTGRES_PORT` when port 5432 is already in use.

Start and stop the service with:

```powershell
docker compose up -d postgres
docker compose ps
docker compose down
```

`pnpm infra:up` starts PostgreSQL, MinIO, and Mailpit together. It requires
Docker Desktop; when Docker is unavailable, the script exits with a clear
installation message.

`pnpm infra:doctor` reports local service connectivity and configured hosted
endpoints. `SUPABASE_URL`, `R2_ENDPOINT`, `EVIMESH_API_URL`, and
`EVIMESH_WEB_URL` may be set to check non-default endpoints; unset hosted
endpoints are reported as `PENDING`, not treated as configured.
`pnpm infra:hosted-readiness` is a separate read-only check for provider CLIs,
non-secret configuration, credentials presence, and hosted origins; it never
prints secret values. See [`docs/hosted-readiness.md`](docs/hosted-readiness.md).

Copy `.env.example` to `.env` for local configuration. Secret names and
development/staging/production separation are documented in
[`docs/infra-secrets.md`](docs/infra-secrets.md); real secret values must stay
outside the repository.
Hosted origin naming and DNS acceptance criteria are documented in
[`docs/infra-domains.md`](docs/infra-domains.md).
R2 CORS policy generation and the account-authorized apply step are documented
in [`docs/infra-r2-cors.md`](docs/infra-r2-cors.md).

MinIO exposes its S3-compatible API on port 9000 and its console on port 9001;
set `EVIMESH_S3_PORT` or `EVIMESH_S3_CONSOLE_PORT` if either port is occupied.
Mailpit captures local SMTP on port 1025 and exposes its message UI on port
8025; set `EVIMESH_SMTP_PORT` or `EVIMESH_MAILPIT_PORT` when needed.
Its permissive SMTP authentication settings are local-test-only. The bundled
PostgreSQL and MinIO credentials must not be reused in hosted environments.

## Workspace

`apps/*` contains product and runtime entry points. `packages/*` contains the
domain, protocol, schema, database, artifact, policy, SDK, CLI, and UI layers.

The protocol package now covers the complete M1 protocol foundation, including
the M1-01 object ID format and M1-02 UUIDv7 generation. Its IDs use stable type prefixes such as
`claim_<canonical-uuid>`; duplicate IDs are rejected by the server and clients
must retry with a newly generated ID. Revision records are append-only: revision
1 starts a lineage, later revisions supersede the previous revision, and
`current` is a projection pointer.
The protocol also distinguishes `raw_hash` (exact submitted bytes) from
`semantic_hash` (canonical JSON semantics).
Project lifecycle validation is frozen as `draft → active → archived`, with
`archived` terminal and illegal reverse transitions rejected.
Question lifecycle validation covers proposal, review, admissibility, active,
resolution, archival, and rejection transitions.
Task lifecycle validation covers open/active execution, blocked recovery,
verification requests, completion, and cancellation.
Attempt lifecycle validation covers active/paused execution and submitted or
abandoned terminal outcomes while retaining trace and evidence associations.
Claim lifecycle validation covers staged promotion plus contested, refuted,
superseded, retracted, and dependency-tainted outcomes.
Challenge lifecycle validation covers admissibility, investigation, and upheld,
rejected, or resolved terminal outcomes.
Frontier snapshots are immutable and append-only, with contiguous `previous`
references and fixed revisions.
ClaimRelation validation freezes all 14 typed edges with explicit source-to-target
semantics.
Dependency validation rejects self-dependencies and direct or indirect
`depends_on` cycles before graph writes.
Evidence validation freezes formal, numerical, experimental, dataset, literature,
counterexample, benchmark, statistical, code-test, negative-result, and expert
assessment types.
Evidence links are restricted to supports, refutes, qualifies, and reproduces,
and target a specific ClaimRevision.
Run Receipt validation covers task/context, input/output artifacts, execution
environment, command, seed, timing, network access, exit code, actor, and signature.
VerificationReceipt validation locks ClaimRevision and ContractRevision while
capturing outcome, context, independence, model family, and findings.
Finding severity is restricted to critical, major, warning, and note with
explicit blocking semantics.
VerificationPolicy validation requires a version, non-empty requirements, and
outcome mappings under the fixed policy schema.
ContextBundle mode validation covers frontier, full_trace, adversarial, and blind
research contexts.
Contribution role validation covers originator, contributor, reviewer, verifier,
witness, and maintainer attribution.
ResearchEvent envelope validation covers namespaced event types, payloads, SHA-256 hashes, signatures, and UUIDv7 parent links.
Client signature envelope validation fixes canonical signing bytes and nonce rules for Ed25519 signatures.
Platform Receipt validation covers server time, accepted event ID, and server signature.
Common JSON Schema now defines shared UUID/UUIDv7, Object ID, revision, hash, actor, identity, timestamp, and signature constraints.
Project JSON Schema now validates Project revision identity, lifecycle state, metadata, and creation provenance.
Question JSON Schema now validates Question revisions and their required ResearchContract reference.
Task JSON Schema now validates task inputs, outputs, acceptance criteria, and context mode.
Claim JSON Schema now validates ClaimRevision statements, scope, assumptions, falsification, and lifecycle state.
Artifact JSON Schema now validates artifact hash, location, license, type, and provenance metadata.
Run JSON Schema now validates the minimum reproducibility receipt fields and execution outcome.
Verification JSON Schema now validates fixed ClaimRevision references, verification outcomes, context, independence, and Finding severity.
Challenge JSON Schema now validates target ClaimRevision references, lifecycle state, and structured impact.
Frontier JSON Schema now validates append-only previous snapshots, members, policy revisions, and SHA-256 checkpoints.
Contribution JSON Schema now validates actor roles and produced/used attribution edges.
Event JSON Schema now validates signed ResearchEvent envelopes and UUIDv7 parent links.
Valid protocol fixtures now cover every schema from M1-28 through M1-38.
Invalid protocol fixtures now provide at least two failure samples for every schema from M1-28 through M1-38.

M1-01 through M1-40 are complete. M2 now includes the local PostgreSQL,
MinIO, and Mailpit development stack plus the minimal Cloudflare Workers API
Edge health contract in [`apps/api-edge`](apps/api-edge/README.md). Hosted
infrastructure and deployment remain gated on the corresponding provider
accounts and credentials.

The Web preview workflow in [`.github/workflows/web-preview.yml`](.github/workflows/web-preview.yml)
deploys `apps/web/public` to the `evimesh-web-dev` Cloudflare Pages project for
same-repository pull requests. It requires `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` to be configured as repository secrets.
Changes to `apps/web` on `main` are deployed by
[`.github/workflows/web-production.yml`](.github/workflows/web-production.yml)
to the separate `evimesh-web` Pages project using the same repository secrets.
