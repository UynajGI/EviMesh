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
