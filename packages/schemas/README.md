# @evimesh/schemas

机器可校验的 JSON Schema 与测试向量。

当前包含 `common.schema.json`：统一定义 UUID/UUIDv7、稳定 Object ID、revision、SHA-256 hash、Actor 类型、Identity 强度、时间戳和 Ed25519 signature 的公共约束。执行 `pnpm --filter @evimesh/schemas test` 检查 schema 元数据与合法/非法测试向量。
