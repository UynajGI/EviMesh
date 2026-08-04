# @evimesh/protocol

命令、Receipt、事件和交换协议。

## 对象 ID（M1-01）

对象 ID 使用稳定的类型前缀和 canonical UUID 组成：

```text
<object-prefix>_<canonical-uuid>
```

当前冻结的对象前缀为：

| 对象 | 前缀 |
| --- | --- |
| Project | `project` |
| Question | `question` |
| Task | `task` |
| Claim | `claim` |
| Evidence | `evidence` |
| Run | `run` |
| Verification | `verification` |
| Frontier | `frontier` |

例如：`claim_550e8400-e29b-41d4-a716-446655440000`。

M1-01 只规定前缀和 UUID 的 canonical 表示。M1-02 使用 UUIDv7 的 48-bit Unix 毫秒时间戳和随机位生成 ID，但不把 ID 改写成服务端序列号。

客户端和服务端都可以生成 UUIDv7。服务端以完整对象 ID 作为唯一键；若发生重复，服务端拒绝冲突写入，客户端重新生成 ID 后重试。服务端不替换客户端提交的合法 ID。

## 不可变 revision（M1-03）

官方对象采用追加式 revision。revision 1 开始一条 lineage，不带 `supersedes`；之后每个 revision 使用新的连续编号，并且必须只 supersede 紧邻的前一个 revision。revision 记录禁止原地覆盖；`current` 只是提交新 revision 及其关系后的指针或 projection。

协议包提供 `createRevision`、`nextRevision`、`isRevision` 和 `assertRevisionSequence`，用于验证这些规则，不绑定具体数据库实现。

## Hash 语义（M1-04）

- `raw_hash` 是提交内容原始字节的 SHA-256 十六进制摘要；字节顺序、空白和编码变化都会改变它。
- `semantic_hash` 是 JSON 语义值的 SHA-256 摘要；对象键按字典序递归排序，数组顺序保留，再对 canonical JSON 编码后计算。

两者都只返回摘要，不互相替代：`raw_hash` 用于证明收到的精确字节，`semantic_hash` 用于比较内容语义。非 JSON 值和非有限数字不能生成 `semantic_hash`。

## Actor 类型（M1-05）

Actor 类型冻结为 `human`、`agent`、`organization`、`service`、`maintainer` 和 `witness`。写入协议字段前必须通过 `assertActorType` 校验；未知值不会被静默降级。

## 身份强度（M1-06）

身份强度冻结为 `verified`、`observed`、`self_declared` 和 `unknown`。它描述身份凭证的强度，不等同于 Actor 类型或科学结论；协议写入前必须通过 `assertIdentityStrength` 校验。
