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

## Project 状态（M1-07）

Project 生命周期为 `draft → active → archived`。`draft` 可直接归档或进入研究，`active` 只能归档，`archived` 是终态，不允许重新打开。状态和迁移都通过协议包的校验函数冻结，非法状态或反向迁移必须拒绝。

## Question 状态（M1-08）

Question 生命周期为 `draft → proposed → under_review → admissible → active`。`under_review` 和 `admissible` 可拒绝；`active` 可 `resolved` 或归档，`resolved` 最终归档；`archived` 与 `rejected` 都是终态。协议包完整冻结状态表并拒绝未列出的迁移。

## Task 状态（M1-09）

Task 生命周期为 `draft → open → active`，执行中可进入 `blocked`、请求验证或直接完成/取消。`blocked` 可恢复为 `active`；`verification_requested` 可回到执行、完成或取消；`completed` 与 `cancelled` 是终态。所有未列出的迁移均拒绝。

## Attempt 状态（M1-10）

Attempt 从 `active` 开始，可暂停、提交或放弃；暂停后可恢复为 `active`，也可提交或放弃。`submitted` 与 `abandoned` 是终态。Attempt 的失败或放弃不删除其 Trace/Evidence 关联。

## Claim 状态（M1-11）

Claim 主链为 `hypothesis → candidate → under_verification → provisionally_accepted → accepted`。主链任一阶段都可以进入 `contested`、`refuted`、`superseded`、`retracted` 或 `dependency_tainted`；这些结果态终止当前 Claim revision 的状态流转。协议不允许跳过主链升级或从结果态重新打开。

## Challenge 状态（M1-12）

Challenge 生命周期为 `open → admissible → investigating`，调查后进入 `upheld`、`rejected` 或 `resolved` 之一；三个结果态都是终态。协议拒绝跳过 admissibility/investigation 或重新打开已结束的 Challenge。

## Frontier 快照（M1-13）

Frontier 是追加式不可变快照链：第一个快照没有 `previous`，之后每个快照引用紧邻的前一个编号并固定自己的 revision。旧快照不更新、不删除；只能通过 `nextFrontier` 生成新快照。快照链必须连续，不能跳号或覆盖。

## ClaimRelation（M1-14）

协议冻结 14 种关系：`depends_on`、`supports`、`refutes`、`qualifies`、`reproduces`、`extends`、`supersedes`、`contradicts`、`derived_from`、`uses_method`、`uses_dataset`、`implements`、`verifies`、`challenges`。每条边都明确记录 `source → target`，关系语义不会因查询方向改变；`depends_on` 的无环约束和 `supersedes` 的旧 revision 约束由后续 DAG 校验补充。

## depends_on DAG（M1-15）

`depends_on` 必须形成有向无环图：不能自依赖，不能增加直接环或递归间接环。`assertDependencyGraph` 校验已有边，`assertDependencyAddition` 在添加新边前拒绝会闭合环的写入。

## Evidence 类型（M1-16）

Evidence 类型冻结为：`formal_proof`、`numerical_result`、`experimental_result`、`dataset`、`literature_support`、`counterexample`、`benchmark`、`statistical_analysis`、`code_test`、`negative_result`、`expert_assessment`。未知类型必须拒绝，不自动降级为通用 Evidence。

## Evidence-Claim Link（M1-17）

Evidence 与 ClaimRevision 的关系冻结为 `supports`、`refutes`、`qualifies`、`reproduces`。链接方向固定为 `Evidence(source) → ClaimRevision(target)`，必须锁定具体 revision；Evidence 是证据对象，不会因建立链接而直接变成 Claim。

## Run Receipt（M1-18）

Run Receipt 必须记录 Task、ContextBundle、输入/输出 Artifact、源码、容器、命令参数、环境、硬件、随机种子、起止时间、网络访问、exit code、Actor 和签名。Receipt 创建时校验字段完整、时间有序，并以不可变对象返回。

## VerificationReceipt（M1-19）

VerificationReceipt 固定 schema `srp.verification-receipt.v1`，必须锁定具体 ClaimRevision 与 ContractRevision，并记录 outcome、verification types、context mode、是否看到预期输出、实现/数据独立性、model family 和结构化 findings。Receipt 不接受缺失字段或无 code/severity 的 finding。

## Finding 严重度（M1-20）

`critical` 表示阻断接受，`major` 表示需要处理的重大问题，`warning` 表示非阻断风险或限制，`note` 表示记录性信息。VerificationReceipt 只接受这四级 severity。

## VerificationPolicy（M1-21）

VerificationPolicy 固定 schema `srp.verification-policy.v1`，由 `policy_id`、正整数 `revision`、非空 `requirements` 和非空 `outcomes` 组成。Policy 版本不可原地修改；新规则必须创建新的 revision，outcomes 负责把 requirements 或关键 Receipt 条件映射到 Claim 状态。
