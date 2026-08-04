# @evimesh/schemas

机器可校验的 JSON Schema 与测试向量。

当前包含 `common.schema.json`：统一定义 UUID/UUIDv7、稳定 Object ID、revision、SHA-256 hash、Actor 类型、Identity 强度、时间戳和 Ed25519 signature 的公共约束。执行 `pnpm --filter @evimesh/schemas test` 检查 schema 元数据与合法/非法测试向量。

M1-28 新增 `project.schema.json`，约束 Project revision 的 schema、稳定 ID、revision、状态、名称、摘要、创建时间和创建者字段，并包含合法/非法向量。

M1-29 新增 `question.schema.json`，以 `$defs/researchContract` 强制问题、定义、背景、范围、进展标准、可接受证据、证伪条件、许可、风险等级和维护者引用。

M1-30 新增 `task.schema.json`，校验 Task revision 的输入、输出、验收标准和 `frontier/full_trace/adversarial/blind` context mode。

M1-31 新增 `claim.schema.json`，校验 ClaimRevision 的 statement、scope、assumptions、falsification 和 Claim 状态机枚举。
