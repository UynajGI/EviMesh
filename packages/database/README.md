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

`DATABASE_URL` is read from the environment, with the local-only Compose URL
used as a development fallback for Drizzle Kit commands. Production URLs must
be provided by the deployment environment.

PostgreSQL schema、迁移、查询和数据库约束。当前为 M3-01 骨架包；包级测试覆盖数据库 client、schema 入口和 Drizzle Kit 配置契约。
