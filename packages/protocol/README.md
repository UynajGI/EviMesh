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

M1-01 只规定前缀和 UUID 的 canonical 表示；UUIDv7 的生成、客户端冲突和服务端冲突规则属于 M1-02。
