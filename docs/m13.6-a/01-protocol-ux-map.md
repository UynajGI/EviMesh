# M13.6-A02 协议 UX 映射

## 目的与边界

本图谱把 EviMesh 的研究协议翻译为可阅读、可追溯、可交接的 Web
体验。它不是另一套写入协议：结构化写入仍由 CLI、MCP、SDK 或用户
Agent 完成；Web 负责展示稳定 ID、精确 revision、关系方向和来源链。

**拒绝“父子树”简化。** Project、Question、Claim、Evidence 等对象组成多
关系有向图与 revision 历史，而不是强制的 `Question → Claim → Evidence`
单父节点树。同一对象可以在四个阅读视角中被引用；切换视角不得改变对象、
关系方向或所指向的 revision。

## 对象、身份、版本与来源

| 对象 | 身份与 revision | 来源（provenance）与 UX 要点 |
| --- | --- | --- |
| Project | 稳定 `projectId`；项目范围内的记录锚点。 | 显示创建者、时间和可定位永久链接；聚合其 Question、活动和 Frontier。 |
| Question | 稳定 `questionId`；问题文本的历史由关联 contract/revision 定界。 | 显示所属 Project、当前 ResearchContract 与相关 Task；不是 Claim 的唯一父节点。 |
| ResearchContract | 稳定 `contractId` 加递增 immutable `revision`。 | 每次修订保留 `supersedes`、创建者、时间和 ETag/事件依据；阅读时明确所用 contract revision。 |
| Task | 稳定 `taskId`；状态变化由事件记录，不以树层级替代依赖。 | 显示针对的 Question/Contract、责任与未决阻塞，并链接相关 Attempt。 |
| Attempt | 稳定 `attemptId`；一次可归因的研究过程。 | 记录参与者、方法、输入、时间与产生的 Claim、Run、Artifact、Evidence。 |
| Claim | 稳定 `claimId`；内容以递增、**不可变** `claimRevisionId` 保存。 | 默认显示当前 revision；历史、替代关系和所有入/出边必须可追溯到精确 revision。 |
| Artifact | 稳定 `artifactId`；内容版本以 hash/不可变 artifact revision 标识。 | 标明生成 Attempt/Run、内容 hash、存储定位和许可证；只展示可访问的来源。 |
| Run | 稳定 `runId`；一次可复现执行记录。 | 标明执行环境、代码/配置/数据输入、开始结束时间、输出 Artifact 与对应 Attempt。 |
| Evidence | 稳定 `evidenceId`；证据内容或引用版本由 hash/不可变引用锚定。 | 追溯到 Artifact、Run、外部来源或采集过程；链接必须指向某个 immutable Claim revision。 |
| VerificationReceipt | 稳定 `receiptId`；回执是不可变的验证记录。 | 必须携带 `claimRevisionId`、`contractRevisionId`、outcome、验证类型、实现/数据独立性及 Run；不得压缩为真伪分数。 |
| Finding | 稳定 `findingId`；属于或由 VerificationReceipt 定位的观察。 | 显示 severity、code、字段路径、来源片段与 receipt；保留原始位置而非只给摘要。 |
| Challenge | 稳定 `challengeId`；质疑及其状态变更可由事件序列审计。 | 显示提出者、影响对象、理由、回应和状态；它可影响 Claim 可接受性，但不抹除历史。 |
| Frontier snapshot | 稳定 `frontierSnapshotId`；发布时冻结的 Claim revision 集合。 | 显示发布时间、选择依据/Policy、成员 revision、前后快照差异和可验证导出来源。 |
| ResearchEvent | 稳定 `eventId`；不可变、可排序的事件记录。 | 每个对象变化都可回链事件、actor、时间、payload 摘要、父事件与 hash/签名或包含证明。 |

共同规则：页面上的“当前”是一个可解释的投影，不能覆盖历史；分享链接应
优先固定到 ID 加 revision 或 snapshot。来源链从阅读对象反向展开到 actor、
Attempt、Run、Artifact、Evidence、Receipt、Contract 和 ResearchEvent；不得
把凭据或敏感 payload 放入 URL 或 handoff。

## 规范关系：方向固定为 source → target

### Claim → Claim（恰好 14 种）

下列关系的 source 与 target 都是 Claim（必要时页面同时展示其精确 revision
上下文）。关系含义严格按 source 对 target 读取：

| 关系 | source → target 的含义 |
| --- | --- |
| `depends_on` | source 需要 target 作为上游依赖。 |
| `supports` | source 为 target 提供支持。 |
| `refutes` | source 为 target 提供反驳。 |
| `qualifies` | source 缩小 target 的适用范围或条件。 |
| `reproduces` | source 复现 target 所述结果。 |
| `extends` | source 扩展 target 的结果或范围。 |
| `supersedes` | source 取代 target 成为当前 revision 或 Claim。 |
| `contradicts` | source 与 target 相矛盾。 |
| `derived_from` | source 从 target 推导而来。 |
| `uses_method` | source 使用 target 所代表的方法。 |
| `uses_dataset` | source 使用 target 所代表的数据集。 |
| `implements` | source 实现 target 的规范或论点。 |
| `verifies` | source 验证 target。 |
| `challenges` | source 对 target 提出质疑。 |

### Evidence → immutable Claim revision（恰好 4 种）

Evidence 的 target **必须**是不可变 `claimRevisionId`，而不是模糊的“当前
Claim”：

| 关系 | source → target 的含义 |
| --- | --- |
| `supports` | Evidence 支持该 Claim revision。 |
| `refutes` | Evidence 反驳该 Claim revision。 |
| `qualifies` | Evidence 限定该 Claim revision 的范围或条件。 |
| `reproduces` | Evidence 复现该 Claim revision 的结果。 |

## 四个互相一致的阅读视角

| 视角 | 首要问题 | 必须呈现 | 与其他视角的一致性 |
| --- | --- | --- | --- |
| Argument（论证） | 这个论点依赖、支持、反驳或挑战什么？ | Claim statement、精确 revision、14 种 Claim 边、历史和 Challenge。 | 点击任何边进入同一 Claim/revision；不把非层级边伪装成父子关系。 |
| Evidence（证据） | 哪些可定位证据以何种方式指向该论点版本？ | Evidence 来源、Artifact/Run、4 种 Evidence 边、hash 与采集/生成链。 | 与 Argument 中相同的 Claim revision；不将证据数量汇总成支持度分数。 |
| Verification（验证） | 在什么 contract、独立性与执行条件下，验证得到什么结果？ | VerificationReceipt、Run、outcome、implementation/data independence、Finding 和目标 Claim/Contract revision。 | Receipt 与 Finding 回链同一 Evidence/Claim 上下文；`supports` 不等同于“已证明为真”。 |
| Frontier（前沿） | 某一发布时点可供下游使用的结论集合是什么，为什么？ | Frontier snapshot、冻结成员 Claim revisions、Policy/选择依据、变更、Challenge 与验证状态。 | 成员跳转到与 snapshot 一致的历史 revision，不能静默替换成最新 Claim。 |

这四个视角共用同一个对象 ID、revision 和 source→target 边；它们只改变阅读
入口与聚合方式。所有列表、图形和键盘可访问的替代列表都必须保留该一致性。

## 范围校正

此前规划文档中的“11 项 Claim 关系”是计数遗漏：缺少 `implements`、
`verifies`、`challenges`。本映射以协议测试所定义的 **14** 项 Claim→Claim
关系及 4 项 Evidence→immutable-Claim-revision 关系为准；此处仅校正文档
理解，不修改协议、任务、路线图或规划文件。
