# @evimesh/database

## M3-01

The package is configured for PostgreSQL with Drizzle ORM and Drizzle Kit.
The schema entry point is `src/schema.mjs`; domain tables and extensions are
added by later M3 tasks.

```powershell
$env:DATABASE_URL="postgresql://evimesh:evimesh_local_only@127.0.0.1:5432/evimesh_dev"
pnpm --filter @evimesh/database db:check
pnpm --filter @evimesh/database db:generate
pnpm --filter @evimesh/database db:migrate
pnpm --filter @evimesh/database test
```

The first migration is the M3-02 PostgreSQL extension baseline. It enables
`pgcrypto` and `uuid-ossp` with idempotent `CREATE EXTENSION IF NOT EXISTS`
statements.

M3-03 lifecycle conventions are exposed through `createLifecycleColumns()`.
Mutable projections use timezone-aware, non-null `created_at` and `updated_at`
columns with database-side current-time defaults, plus nullable `deleted_at`
for soft deletion. Queries should exclude non-null `deleted_at` unless they
explicitly request deleted/history rows.

M3-04 adds the stable `actors` identity table. Its enum values mirror the
 frozen M1 protocol vocabulary; `actor_id` is the stable text primary key.

M3-05 adds the one-to-one `actor_profiles` presentation projection. Optional
display fields remain separate from stable actor identity, and deleting an
actor cascades to its profile.

M3-06 adds `identities` for external login bindings. The `(provider, subject)`
pair is unique, while provider credentials and access tokens remain outside
this table.

M3-07 adds `signing_keys` for public verification material. `key_id` matches
the protocol signature envelope, the algorithm defaults to `Ed25519`, and
private key material is never stored here.

M3-08 adds `api_tokens`. Only a unique token hash, safe display prefix, scopes,
and lifecycle timestamps are persisted; the plaintext token is never a column.

M3-09 adds `organizations`, binding a stable organization identity to exactly
one organization actor and a unique slug. Membership and role data belong to
the following M3-10 table.

M3-10 adds `organization_members` with a composite organization/actor key.
Its role is intentionally an extensible text field until the later
authorization milestone freezes role semantics.

M3-11 adds the stable `projects` projection using the M1 project states and
revision fields. Project maintainer membership remains in the later
`project_members` table.

M3-12 adds append-only `project_revisions`. Each project revision has a
composite `(project_id, revision)` key, a required predecessor for revisions
after 1, and no mutable lifecycle columns.

M3-13 adds `project_members` with a composite project/actor key. Its role is
an extensible text projection until M4-21 freezes the authorization enum.

M3-14 adds stable `questions` identity records scoped to a Project. M3-15 adds
immutable `question_revisions` records containing the revision's title,
statement, and research-contract content. M3-16 adds stable
`research_contracts` identity records; their immutable versioned content is
defined by M3-17. M3-17 stores the structured ResearchContract fields in
append-only `research_contract_revisions` records.
M3-18 adds stable `tasks` identity records with optional Question scope and the
M1 Task lifecycle state.
M3-19 adds append-only `task_revisions` with Task content, acceptance data, and
context mode.
M3-20 adds typed, non-self `task_dependencies` edges with a composite source/
target key; cycle prevention remains an application/protocol invariant.
M3-21 adds non-exclusive, expiring `task_leases` markers keyed by Task and
holder Actor; leases never block parallel Attempts.
M3-22 adds independent `attempts` records linking a Task to an Actor with the
M1 Attempt state lifecycle.
M3-23 adds append-only `trace_events` with signed payload, hash, parent IDs,
and event-type integrity checks.
M3-24 adds stable `claims` identity records with optional Question scope and
the M1 Claim lifecycle state; Claim content belongs to M3-25 revisions.
M3-25 adds immutable `claim_revisions` with statement, epistemic boundaries,
and contiguous revision constraints.
M3-26 adds directed, typed `claim_relations` with a composite edge key; DAG
self-dependency and cycle enforcement remain protocol/application constraints.

M3-27 adds the stable-identity `artifacts` table. Artifact content and
locations belong to later revision/location tables; this table only owns the
stable ID, creator, and lifecycle projection.

M3-28 adds append-only `artifact_revisions` with contiguous revision links,
typed content metadata, raw/semantic hash fields, and non-negative byte size.

M3-29 adds append-only `artifact_locations` records. A stable Artifact may
have multiple URI-backed locations, while duplicate Artifact/URI pairs are
rejected without changing prior revisions.

M3-30 adds immutable `runs` for the execution-boundary fields of a Run
Receipt. Input and output Artifact associations are normalized in M3-31 and
M3-32.

M3-31 adds `run_inputs` with a composite Run/Artifact/revision key and a
composite foreign key to `artifact_revisions`, so a recorded input cannot
silently drift to another revision.

M3-32 adds the symmetric `run_outputs` table with the same concrete revision
lock and restrictive foreign-key behavior.

M3-33 adds typed, Artifact-revision-backed `evidence` records with an
optional originating Run. Evidence-to-Claim semantics are modeled separately
by `evidence_claim_links` in M3-34.

M3-34 adds the four protocol link types (`supports`, `refutes`, `qualifies`,
`reproduces`) and a composite Claim revision foreign key, preserving the
Evidence → ClaimRevision direction.

M3-35 adds stable `verification_contracts` identities with actor ownership and
the standard lifecycle projection; versioned contract content follows in
M3-36.

M3-36 adds append-only `verification_contract_revisions` with contiguous
revision links and machine-readable requirements, verification types, and
context modes.

M3-37 adds stable `verification_policies` identity rows with actor ownership
and lifecycle timestamps for policy revisions.

M3-38 adds append-only `verification_policy_revisions` with contiguous
revision links and machine-readable requirements and outcomes.

M3-39 adds immutable `verification_receipts` anchored to concrete claim and
verification-contract revisions, with independence metadata and an explicit
verification outcome.

M3-40 adds typed `verification_findings` attached to a receipt, preserving
severity, machine-readable code, and structured finding details.

M3-41 adds stable `challenges` identity rows with actor ownership and
lifecycle timestamps for challenge revisions.

M3-42 adds append-only `challenge_revisions` that lock a target Claim revision
and preserve challenge state, reason, impact, and proposed resolution.

M3-43 adds `challenge_impacts` records linking an upheld challenge revision
to each affected downstream Claim revision with typed impact metadata.

M3-44 adds `merge_proposals` that pin a candidate Claim revision to the exact
Policy revision used for evaluation, preserving proposal status and results.

M3-45 adds immutable `frontier_snapshots` anchored to a Project revision with
contiguous per-project sequence numbers and a fixed checkpoint payload.

M3-46 adds immutable `frontier_members` rows that pin each member to a
concrete Claim revision within one Frontier snapshot.

M3-47 adds immutable `context_bundles` records that bind a compiled context
to a concrete Task revision, mode, content hash, and storage URI.
and self-dependency enforcement are subsequent database constraints.

`DATABASE_URL` is read from the environment, with the local-only Compose URL
used as a development fallback for Drizzle Kit commands. Production URLs must
be provided by the deployment environment.

PostgreSQL schema、迁移、查询和数据库约束。当前为 M3-01 骨架包；包级测试覆盖数据库 client、schema 入口和 Drizzle Kit 配置契约。
