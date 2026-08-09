# M13.6-A04：Claim 状态摘要契约

## 目的与范围

本契约定义面向人的、中文优先的 Claim 状态摘要应陈述什么，以及每一项陈述
如何回到不可变研究记录。它是阅读与追溯契约，不定义 API、读取模型、数据库
查询、页面布局或交互实现。

摘要的对象是一个明确的 `claimId` 与一个明确的不可变 `claimRevisionId`。若摘要
使用“当前”Claim revision，必须同时给出该当前指针的 `asOf` 边界；不得把当前投影
写成对任一历史 revision 的改写。

## 通用输入、边界与来源规则

每次生成或阅读摘要必须声明以下上下文；缺少任一必需项时，对应结论显示“未知”，
而不是补全或推测：

| 上下文字段 | 必须内容 | 边界 |
| --- | --- | --- |
| 摘要目标 | `claimId`、`claimRevisionId`、该 revision 的 `state` | 该 Claim revision；`state` 若为当前投影，附 `asOf`。 |
| 观察边界 | `asOf`（含时区或等价可排序事件边界） | 只纳入在边界前已可读取、且属于目标 revision 的记录；边界后记录不倒灌。 |
| 权限与可见性 | 适用的可见性范围或“未提供” | 不可见记录不可以“没有”表示。 |
| 关联输入集 | 每个聚合的对象类型、筛选谓词与关系方向 | 输入集必须可重建为对象 ID 列表；空集、未知集与不适用集互不等同。 |
| 来源锚点 | 对每个结论的对象 ID 加 revision、receipt、snapshot 或 event | 至少一个可定位锚点；聚合还须保留其输入集和 `asOf`。 |

“无记录”只可陈述为“在已声明输入集与 `asOf` 内未找到记录”。它不表示支持、
反驳、已验证、安全、无影响或任何其他正面结论。证据、回执、Finding、Challenge
或 Frontier 成员的缺席均不得推导出正面结论。

## 状态摘要条目

下表的每一行都是独立结论或聚合。摘要可按需要省略不适用的行，但不得以省略暗示
正面结果。所有自然语言标签应使用中文；协议字段名仅作为可展开的技术详情。

| 摘要条目（中文优先） | 必须陈述 | 输入集与 `asOf` | 逐项来源锚点 | 未知／不适用 |
| --- | --- | --- | --- | --- |
| 已选论断修订与状态 | `claimId`、`claimRevisionId`、不可变修订内容的标识，以及该修订的 `state`。 | 仅此 Claim revision；状态投影截至声明的 `asOf`。 | `claimId` + `claimRevisionId`；状态变更另附其 `eventId` 或该 revision。 | 找不到修订为“未知”；无状态字段为“不适用／未提供”。 |
| Frontier 成员资格与快照 | 在指定或“截至 `asOf` 的最新有效” `FrontierSnapshot` 中是否包含**同一** `claimRevisionId`；不得用同一 `claimId` 的其他 revision 替代。 | 已声明 snapshot，或截至 `asOf` 的有效 snapshot 链；成员输入集为该 snapshot 的冻结 `claimRevisionId[]`。 | `frontierSnapshotId` + `snapshotRevisionId` + `claimRevisionId`，并附发布 `eventId`（如有）。 | 无可判定 snapshot 为“未知”；该项目／Claim 不适用 Frontier 时为“不适用”。 |
| Evidence 关系桶 | 分别列出 `supports`、`refutes`、`qualifies`、`reproduces` 四个桶。每桶只陈述指向该 `claimRevisionId` 的 Evidence；可给出条目列表和描述性数量。 | 每桶输入集为 `Evidence -> claimRevisionId`、关系类型等于该桶、且在 `asOf` 前可见的链接；记录空、未知、不可见须区分。 | 每个条目：`evidenceId` + `evidenceRevisionId` 或内容 `hash` + `claimRevisionId`；链接的 `eventId`（如有）。 | 任何桶均可为“空集”“未知”或“不适用”，三者不得混写。 |
| 验证结果 | 按 `VerificationReceipt.outcome` 展示适用于该 Claim revision 的结果（如 `supports`、`refutes`、`qualifies`、`inconclusive`），并保留每条回执，而不是只给汇总。 | 输入集为目标为该 `claimRevisionId`、在 `asOf` 前可见的 `VerificationReceipt`；按每条 receipt 的合同／Policy 语境分组。 | 每条结果：`receiptId` + `receiptRevisionId` + `claimRevisionId` + `contractRevisionId` + `policyRevisionId`；附 `eventId`（如有）。 | 没有回执只表示该输入集为空；结果字段缺失为“未知”。 |
| 实现与数据独立性 | 对每条适用的验证回执陈述 implementation independence 与 data independence 的原始分类或“未提供”；不得合成为可信度。 | 与“验证结果”完全相同的 receipt 输入集和 `asOf`；不得混入其他 Claim revision 的 profile。 | `receiptId` + `receiptRevisionId`，以及该 receipt 的 `contractRevisionId`／`policyRevisionId`。 | 该验证类型不评估独立性为“不适用”；未记录为“未提供／未知”。 |
| 未解决 Finding 的最高严重程度 | 只在已声明的未解决 Finding 输入集内陈述最高 `severity`；同时列出所有达到该等级的 Finding，避免一个标签掩盖来源。 | 输入集为关联上述 receipt、目标为该 `claimRevisionId`、在 `asOf` 时仍未解决的 Finding；严重程度仅为 `critical`、`major`、`warning`、`note`。 | 每个最高等级 Finding：`findingId` + `findingRevisionId` + `receiptId`，以及状态／变更 `eventId`。 | 输入集为空时写“未发现未解决 Finding（限该输入集）”；无法取得解决状态为“未知”。 |
| 活跃 Challenge 与影响 | 列出截至 `asOf` 仍活跃、目标为该 `claimRevisionId` 的 Challenge，并展示其已记录的受影响 Claim revision；不得从 Challenge 的存在推断 Claim 已被反驳。 | 输入集为 `challengeId` 目标等于该 `claimRevisionId` 且当前状态为活跃的 Challenge revisions；影响输入集为其明确记录的 `challenge_impacts`，同受 `asOf` 限制。 | 每项：`challengeId` + `challengeRevisionId` + 目标 `claimRevisionId` + `policyRevisionId`；每个影响附受影响 `claimId` + `claimRevisionId` 和关联 `eventId`（如有）。 | 没有活跃 Challenge 仅表示该输入集为空；影响未记录为“未提供”，不是“无影响”。 |
| Policy 与 Contract 修订 | 对每项来自 Verification、Challenge 或 Frontier 的结论，显示其适用的 `policyRevisionId` 和／或 `contractRevisionId`，不得把不同规则版本合并为一个结论。 | 输入集为摘要中实际引用的 receipts、challenges、snapshots 与其声明的 Policy／Contract revision；截至各对象的固定记录及摘要 `asOf`。 | 对每条结论附其对象 ID + `policyRevisionId`／`contractRevisionId`，以及 receipt、snapshot 或 event 锚点。 | 某对象不使用该规则为“不适用”；字段未记录为“未提供”。 |
| 最近 ResearchEvent | 只陈述在已声明对象范围内、且不晚于 `asOf` 的可排序最新事件；“最近”不是对象内容的修订。 | 输入集为与 `claimId`、`claimRevisionId` 或摘要实际引用对象关联的 `ResearchEvent`，按协议排序规则在 `asOf` 截断。 | `eventId` + `eventRevisionId` + `hash`／`signature`，并附受影响对象 ID 与 revision、receipt 或 snapshot。 | 没有事件为“输入集为空”；事件排序或可见性不足为“未知”。 |

## 聚合与解释限制

1. 每一个数量、分布、最高等级、最近项、成员资格或“无记录”都是聚合结论；它必须
   同时带有输入集定义、`asOf` 和上表要求的来源锚点。
2. 数量只能描述输入集大小，不得成为关于 Claim 真伪、接受度、质量、风险已解除或
   科学共识的结论。Canonical relation count 固定为 **14 种 Claim→Claim** 关系和
   **4 种 Evidence→immutable-Claim-revision** 关系；该固定枚举不是支持度计算器。
3. 不得显示或导出百分比、进度条、置信度颜色、红黄绿真伪颜色，或任何由数量推导的
   真伪／支持度／可信度声明。颜色若用于其他可访问性提示，必须有同等文本标签，且不
   得编码此类结论。
4. `supports`、`refutes`、`qualifies`、`reproduces` 的存在只陈述对应关系或回执结果；
   它们不单独证明、否定或量化 Claim。`inconclusive` 同样不是正面或负面结论。
5. 任何跨 revision、跨 Policy、跨 Contract 或跨 Frontier snapshot 的比较必须显式列出
   两端对象 ID、revision／receipt／snapshot／event 和各自 `asOf`；不能静默合并。

## Canonical 关系枚举

Claim→Claim 的 14 种关系为：`depends_on`、`supports`、`refutes`、`qualifies`、
`reproduces`、`extends`、`supersedes`、`contradicts`、`derived_from`、`uses_method`、
`uses_dataset`、`implements`、`verifies`、`challenges`。其方向固定为 source→target，
关系摘要必须保留两端 Claim 的 ID 与所选 revision 上下文。

Evidence→immutable-Claim-revision 的 4 种关系为：`supports`、`refutes`、`qualifies`、
`reproduces`。其 target 必须是 `claimRevisionId`，不能降级为仅指向 `claimId` 或“当前
Claim”。

## 最小可追溯输出形状

任何符合本契约的摘要至少能被还原为以下概念字段；字段为“未提供”时必须原样表述，
不得用空值推导含义：

```text
目标：claimId + claimRevisionId + state + asOf
每项结论：自然语言陈述 + 输入集定义 + asOf + 对象 ID + revision/receipt/snapshot/event
聚合：输入对象 ID 列表（或可重建集合）+ 过滤谓词 + asOf
未知性：空集 | 未知 | 未提供 | 不适用（四者显式区分）
```

该形状只规定可追溯内容，不规定传输格式、端点、字段命名、读取逻辑或用户界面。
