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

`DATABASE_URL` is read from the environment, with the local-only Compose URL
used as a development fallback for Drizzle Kit commands. Production URLs must
be provided by the deployment environment.

PostgreSQL schema、迁移、查询和数据库约束。当前为 M3-01 骨架包；包级测试覆盖数据库 client、schema 入口和 Drizzle Kit 配置契约。
