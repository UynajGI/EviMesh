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

`DATABASE_URL` is read from the environment, with the local-only Compose URL
used as a development fallback for Drizzle Kit commands. Production URLs must
be provided by the deployment environment.

PostgreSQL schema、迁移、查询和数据库约束。当前为 M3-01 骨架包；包级测试覆盖数据库 client、schema 入口和 Drizzle Kit 配置契约。
