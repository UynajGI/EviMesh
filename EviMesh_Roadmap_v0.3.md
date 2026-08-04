# EviMesh Roadmap：开放分布式科研推进网络

> 让任何人使用自己的 AI、工具、代码和算力，在同一个可验证的科研状态机中持续推进开放问题。

- 文档版本：v0.3
- 日期：2026-08-04
- 架构版本：数据库原生、托管基础设施、GitHub 公共镜像
- 产品入口：Web + CLI + MCP + REST API
- 初期模式：免费开放、无代币、无经济奖励、Bring Your Own Agent / Model / Compute
- 默认部署：托管 PostgreSQL/Auth + 托管对象存储 + Serverless API
- 代码与协议：开源
- 本文范围：完整项目、协议、产品与技术方案；不包含开发原子任务表

---

## 0. 执行摘要

EviMesh 不是一个让 AI 随意回答科研问题的聊天网站，也不是一个由平台统一购买和编排模型的集中式多 Agent 系统。

EviMesh 是一套面向人类与任意 Agent 的**开放科研推进协议和协作产品**。它把复杂问题拆成可独立处理的任务，把阶段性成果表示为原子的科学声明（Claim），把代码、数据、运行过程、验证结果和反例固定成可追溯证据，再由不同的人类、模型、程序和算力节点沿着 Claim DAG 持续提出、复现、挑战、修订和合并，维护一个版本化的“已验证研究前沿”（Verified Frontier）。

平台不决定参与者使用 Fable、Flash、Claude、Gemini、Qwen、DeepSeek、本地模型、符号系统、定理证明器还是传统科研软件。参与者只需通过 Web、CLI、MCP 或 REST API 读取任务与上下文、提交结构化成果。模型选择、Agent Harness、推理过程和算力来源全部由参与者决定。

### 0.1 最终架构选择

EviMesh 采用：

> **自建产品 + 自有数据模型 + 托管 PostgreSQL/Auth + 托管对象存储 + GitHub 公共镜像。**

```text
人类用户 ──────────────→ EviMesh Web
任意 Agent ─→ CLI/MCP ─→ EviMesh API
                              │
                 ┌────────────┼────────────┐
                 ↓            ↓            ↓
           PostgreSQL     Object Store   Job Worker
           状态与关系图    证据与数据      校验与快照
                 └────────────┼────────────┘
                              ↓
                    Integrity Layer
              Revision / Hash / Signature / Event
                              ↓
               Frontier Export / GitHub Release
                    / Witness / 可选时间戳
```

数据库负责低延迟查询、事务、权限、草稿、通知和产品体验；不可变 revision、哈希、签名、追加事件、Merkle checkpoint 和公共导出负责可信历史。GitHub 只用于代码协作、协议规范、CI/CD、公开 Frontier Release、公共镜像与灾难恢复，不承担用户的日常科研操作。

### 0.2 初期不发行代币

初期不设计代币、积分经济或自动奖金。参与动力来自：

1. 使用自己的 Agent 参与真实科研问题；
2. 获得可验证、可引用、可分享的贡献页面；
3. 让个人模型和工作流进行真实的公开科研评测；
4. 与不同模型、人类和工具形成并行探索；
5. 保留失败、反例、复现和中间步骤的长期价值；
6. 后续赞助到来时，基于 Contribution Graph 进行追溯性资助。

### 0.3 核心技术判断

- 采用区块链中的内容寻址、签名、哈希链接、Merkle 日志和独立见证经验；
- 不构建金融链，不采用 PoW、PoS、代币和智能合约；
- 不用“多数模型同意”代替科学验证；
- 不要求任何参与者公开隐藏思维链；
- 不在 MVP 中托管执行陌生人的任意代码；
- 不把托管数据库当作不可替换的事实唯一副本；
- 每个 Frontier 都可导出为离线可验证研究包。

---

## 1. 项目定义

### 1.1 一句话定义

**EviMesh 是一个面向人类与任意 AI Agent 的开放科研状态机：研究以 Claim DAG 分支，以可执行证据推进，以独立验证合并，以贡献图永久溯源。**

### 1.2 产品使命

让复杂科研问题不再只能等待一个实验室、一个团队或一篇论文完整解决，而是可以：

```text
公开提出
→ 明确定义
→ 拆成原子任务
→ 被全球不同 Agent 并行探索
→ 形成局部 Claim
→ 绑定证据和运行记录
→ 被独立复现或反驳
→ 合并进版本化 Frontier
→ 生成下一轮任务
```

### 1.3 产品定位

EviMesh 位于以下系统之间：

- GitHub 擅长代码协作，但不理解科学声明、证据合同和研究前沿；
- arXiv 与期刊擅长发布线性论文，但不能完整保存分支、失败和持续修订；
- BOINC 擅长分发算力，但不负责推理拆解、证据判断和科研共识；
- 多 Agent 框架擅长编排某一套模型，但通常由一个组织集中控制；
- 区块链擅长维护不可篡改的经济状态，但不能判断科学结论；
- OKF 提供开放知识交换思路；
- ARA 提供 Agent 原生科研成果结构；
- EviMesh 负责跨参与者、跨模型、跨组织的长期推进、验证、合并与贡献归因。

### 1.4 非目标

MVP 与前期版本明确不做：

- 不提供统一模型聚合或模型路由市场；
- 不保存用户的模型 API Key；
- 不替用户购买模型额度或算力；
- 不要求使用特定 Agent 框架；
- 不把模型数量、点赞数或简单投票当成真值；
- 不强制公开模型隐藏推理过程；
- 不托管运行陌生人提交的任意代码；
- 不发行代币；
- 不建设公链；
- 不一次覆盖所有科学领域；
- 不取代实验室复现、同行评审和领域专家；
- 不做单一全球贡献排行榜；
- 不承诺自动解决所有开放科学问题。

---

## 2. 架构决策

### 2.1 为什么不继续使用 GitHub 作为数据库

当用户只通过 Web、CLI 和 MCP 操作时，把 GitHub 隐藏成内部数据库会形成不必要的转换链：

```text
科研动作
→ Gateway
→ Branch
→ Pull Request
→ Actions
→ Merge
→ 静态索引
→ 前端状态翻译
```

这会同时承担自建应用的复杂度和 GitHub 数据模型的限制，并导致事务困难、状态延迟、频繁内部提交、搜索与权限别扭、API 限流以及索引一致性问题。

因此，EviMesh 的运行时主状态由 PostgreSQL 管理；GitHub 降级为公共出口和工程协作系统。

### 2.2 为什么不全部自托管

项目早期的核心风险是协议和产品是否有效，而不是服务器运维能力。自行部署和维护 PostgreSQL、对象存储、邮件、备份、连接池和高可用会分散精力。

因此前期采用托管服务，但确保：

- 使用标准 PostgreSQL；
- 使用 S3 兼容对象接口；
- 核心 Schema、事件和导出格式公开；
- 数据可定期导出；
- 不在业务模型中使用不可迁移的供应商专有语义；
- 有本地 Docker Compose 参考部署；
- 有从托管服务恢复到自托管环境的演练。

### 2.3 数据库与不可变性的关系

数据库不是科学事实本身的唯一证明。EviMesh 使用：

```text
关系数据库当前投影
+ 不可变对象 revision
+ 追加 Research Event
+ 内容哈希
+ 客户端/服务端签名
+ Merkle checkpoint
+ 公共 Frontier Bundle
```

数据库负责运行效率，完整性层负责可验证历史。

---

## 3. 设计原则

### P1. 模型中立

平台只定义对象、上下文、证据和交互协议，不定义参与者必须使用的模型。

### P2. 用户自带 Agent、模型与算力

探索在参与者自己的电脑、服务器、IDE、Agent Harness、实验环境或实验室中完成。

### P3. 人类只操作科研语义

Web 中只出现 Question、Task、Attempt、Claim、Evidence、Verification、Challenge 和 Frontier，不要求用户理解 Git、PR 或数据库。

### P4. 声明优先

可合并进前沿的成果必须落到可引用、可限定、可证伪的 Claim，不能只提交一篇长答案。

### P5. 证据优先

接受状态由版本化 Verification Policy 计算。Agent 赞成只是一个可审计意见，不是科学证明。

### P6. 追加历史

正式对象不能原地覆盖。修订产生新的 revision；旧 revision 永久保留并可被 supersede、retract 或 contest。

### P7. 前沿推进与盲探并行

主线 Agent 可以基于 Frontier 推进；Blind 与 Adversarial lane 必须长期存在，避免群体被错误主线锁死。

### P8. 人类可读、机器可操作

对象能够导出为 Markdown/YAML/JSON，底层使用严格 Schema、规范化编码和内容哈希。

### P9. 可移植优先

托管服务是部署方式，不是协议的一部分。所有正式成果都可离线导出和验证。

### P10. 开放不等于无边界

隐私、版权、提示注入、恶意文件、危险代码和高风险科研必须具有权限、审核和治理边界。

---

## 4. 系统分层

```text
┌─────────────────────────────────────────────────────────┐
│ Product Layer                                           │
│ Web、Workspace、看板、Claim DAG、Frontier、贡献页、检索   │
├─────────────────────────────────────────────────────────┤
│ Access Layer                                            │
│ REST/OpenAPI、SSE、CLI、MCP、TypeScript/Python SDK       │
├─────────────────────────────────────────────────────────┤
│ Domain Layer                                            │
│ Question、Task、Claim、Verification、Challenge、Frontier │
│ Command、Policy、State Machine、Contribution             │
├─────────────────────────────────────────────────────────┤
│ Artifact Layer                                          │
│ OKF 风格交换对象 + ARA 风格 logic/src/trace/evidence      │
├─────────────────────────────────────────────────────────┤
│ Integrity Layer                                         │
│ Immutable Revision、Hash、Signature、Event、Merkle        │
├─────────────────────────────────────────────────────────┤
│ Runtime Layer                                           │
│ PostgreSQL、Object Store、Queue/Worker、Search、Cache     │
├─────────────────────────────────────────────────────────┤
│ Public Audit Layer                                      │
│ Frontier Bundle、GitHub Release、Witness、时间戳          │
└─────────────────────────────────────────────────────────┘
```

### 4.1 OKF 的使用方式

采用 Markdown/YAML、来源、生成者、验证者、生命周期和可移植知识包的思想，作为人类可读交换层。EviMesh 在此基础上增加严格 JSON Schema、状态机、固定 revision 和科研关系语义。

### 4.2 ARA 的使用方式

采用 `logic / src / trace / evidence` 的研究成果结构，以及 Claim、证伪条件、实验、失败路径和 Seal 的思想。EviMesh 将单个研究 Artifact 扩展为多参与者并行推进网络。

### 4.3 EviMesh 自己负责的部分

- 公开问题与任务发现；
- 多 Agent 并行 Attempt；
- Claim DAG；
- Blind/Adversarial 验证；
- 验证策略与状态升级；
- Challenge 与下游污染；
- Frontier 合并和回滚；
- Contribution Graph；
- 身份、签名和透明日志；
- 后续赞助接口；
- 多实例联邦协议。

---

## 5. 参与者与权限模型

### 5.1 Actor 类型

```text
human
agent
organization
service
validator
maintainer
witness
```

Agent 可以独立拥有 Actor ID，也可以声明由某个人类或组织运行。

### 5.2 身份层

前期支持：

1. 平台账号：Supabase Auth 管理登录、Session 和恢复；
2. 社交身份：GitHub/OIDC，可选；
3. 学术身份：ORCID、机构邮箱或机构主页，可选；
4. 签名身份：Ed25519 公钥，可由 Web、CLI 或 Agent 注册；
5. API Token：CLI/MCP 使用，限定 scope；
6. 服务身份：后台 Worker 与导出服务。

### 5.3 身份强度标记

所有身份属性区分：

```text
cryptographically_verified
provider_verified
platform_observed
self_declared
unknown
```

模型名称、模型族、组织独立性和提示独立性在早期往往只能自报，界面不得将其显示为已证明事实。

### 5.4 权限原则

- 公共读默认开放；
- 写操作必须认证；
- 正式提交必须产生签名或平台 Receipt；
- Project 维护权限与科学真值无关；
- 维护者不能跳过 Evidence 和 Policy；
- 高风险项目单独授权；
- 所有管理员动作写入 Research Event；
- API Token 使用最小 scope。

---

## 6. 核心对象模型

| 对象 | 含义 |
|---|---|
| `Project` | 长期研究主题和治理空间 |
| `Question` | 明确的问题、目标或待检验假设 |
| `ResearchContract` | 范围、定义、验收、证据类型、许可和风险边界 |
| `Task` | 可由一个参与者或 Agent 执行的原子工作单元 |
| `TaskLease` | 非独占的“正在研究”标记 |
| `Attempt` | 某 Actor 针对 Task 的一次独立探索 |
| `TraceEvent` | 可公开的决策、工具调用、失败与转向摘要 |
| `Claim` | 稳定科学声明身份 |
| `ClaimRevision` | Claim 的不可变具体版本 |
| `ClaimRelation` | Claim 与其他对象之间的类型化关系 |
| `Artifact` | 代码、数据、图、证明、笔记、容器或模型 |
| `ArtifactRevision` | Artifact 的不可变 Manifest |
| `Run` | 一次实际执行及其环境、输入与输出 |
| `Evidence` | 支持、反驳或限定 Claim 的固化证据 |
| `VerificationContract` | 如何验证某类 Claim 的合同 |
| `VerificationPolicy` | Claim 状态升级的版本化规则 |
| `VerificationReceipt` | 某验证者执行检查后的签名结果 |
| `Finding` | 结构化审计问题 |
| `Challenge` | 对 Claim、Evidence、Run 或 Policy 的异议 |
| `MergeProposal` | 将对象合并进 Frontier 的提案 |
| `FrontierSnapshot` | 项目某一时刻可依赖的不可变前沿 |
| `ContextBundle` | 为特定任务编译的最小上下文包 |
| `Synthesis` | 从研究图编译的人类报告或论文草稿 |
| `ContributionStatement` | 对科研活动和角色的归因 |
| `ResearchEvent` | 正式状态变化的不可变事件 |
| `MerkleCheckpoint` | 一批事件的透明日志根和证明 |

---

## 7. 状态机

### 7.1 Question

```text
draft
→ proposed
→ under_review
→ admissible
→ active
→ resolved / archived / rejected
```

### 7.2 Task

```text
draft
→ open
→ active
→ blocked
→ verification_requested
→ completed / cancelled
```

TaskLease 是软租约，不阻止其他 Actor 并行探索。

### 7.3 Attempt

```text
active
→ paused
→ submitted
→ abandoned
```

失败或放弃的 Attempt 仍可产生有价值的 Trace 与 Evidence。

### 7.4 Claim

```text
hypothesis
→ candidate
→ under_verification
→ provisionally_accepted
→ accepted
```

任何阶段都可以进入：

```text
contested
refuted
superseded
retracted
dependency_tainted
```

“Accepted”始终意味着：

> Accepted under 某个明确版本的 Verification Policy。

它不是脱离范围和条件的绝对真理标签。

### 7.5 Challenge

```text
open
→ admissible
→ investigating
→ upheld / rejected / resolved
```

### 7.6 Frontier

Frontier 不修改旧快照，只生成新快照：

```text
Frontier 23
→ Frontier 24
→ Frontier 25
```

历史 Frontier 永久可访问和导出。

---

## 8. Claim DAG

### 8.1 关系类型

```text
depends_on
supports
refutes
qualifies
reproduces
extends
supersedes
contradicts
derived_from
uses_method
uses_dataset
implements
verifies
challenges
```

### 8.2 DAG 规则

- `depends_on` 必须无环；
- `supersedes` 必须指向旧 revision 或旧 Claim；
- `refutes` 不删除目标对象；
- `qualifies` 用于收窄适用范围；
- Evidence 不直接变成 Claim；
- VerificationReceipt 必须锁定具体 ClaimRevision；
- FrontierMember 必须锁定具体 revision；
- 下游依赖污染通过递归查询传播；
- 图查询初期由 PostgreSQL `WITH RECURSIVE` 实现，不引入 Neo4j。

### 8.3 稳定 ID 与 revision

```text
Claim SQ-C-0019
├── revision 1 / semantic_hash A
├── revision 2 / semantic_hash B
└── revision 3 / semantic_hash C
```

- 稳定 ID 用于长期 URL 和身份；
- revision 是不可变版本；
- current_revision_id 只是查询指针；
- Frontier 引用具体 revision，不引用模糊的 latest。

---

## 9. 数据库设计

EviMesh 使用**标准关系表 + 不可变 revision + 追加事件**，不使用普通 CMS 的覆盖式更新，也不把全部 UI 状态强行实现为纯事件溯源。

### 9.1 身份与组织

```text
actors
actor_profiles
identities
signing_keys
api_tokens
organizations
organization_members
project_members
```

### 9.2 项目与任务

```text
projects
project_revisions
questions
question_revisions
research_contracts
research_contract_revisions
tasks
task_revisions
task_dependencies
task_leases
attempts
trace_events
```

### 9.3 Claim 与关系

```text
claims
claim_revisions
claim_relations
claim_status_transitions
```

### 9.4 Artifact、Run 与 Evidence

```text
artifacts
artifact_revisions
artifact_locations
artifact_chunks
runs
run_inputs
run_outputs
evidence
evidence_claim_links
```

### 9.5 验证与挑战

```text
verification_contracts
verification_contract_revisions
verification_policies
verification_policy_revisions
verification_receipts
verification_findings
challenges
challenge_revisions
challenge_impacts
```

### 9.6 Frontier 与贡献

```text
merge_proposals
frontier_snapshots
frontier_members
context_bundles
syntheses
contribution_statements
contribution_edges
```

### 9.7 完整性和运行

```text
research_events
research_event_parents
event_outbox
merkle_checkpoints
merkle_leaves
export_jobs
mirror_receipts
moderation_cases
notifications
follows
```

### 9.8 事务规则

一个正式命令在单个数据库事务中完成：

```text
校验权限
→ 锁定当前 revision
→ 写入新 revision
→ 写入关系
→ 追加 ResearchEvent
→ 更新 current pointer / projection
→ 写入 Outbox
→ 提交事务
```

对象存储上传采用两阶段流程，只有 hash、size 和对象存在性验证完成后，Evidence 才进入正式状态。

---

## 10. 不可变对象与内容寻址

### 10.1 两类哈希

```text
raw_hash
```

原始字节的 SHA-256，用于下载验证和法证。

```text
semantic_hash
```

结构化对象经过规范化编码后的哈希，用于语义版本和去重。

MVP 可以先使用 canonical JSON；后续兼容 DAG-CBOR 与 CIDv1。

### 10.2 对象存储键

对象存储禁止覆盖正式 Artifact：

```text
sha256/<前两位>/<完整哈希>
```

内容变化必然生成新地址。

### 10.3 Artifact Manifest

```yaml
schema: srp.artifact.v1
artifact_id: ...
revision: 1
kind: dataset
raw_hash: sha256:...
semantic_hash: sha256:...
size_bytes: ...
media_type: ...
locations:
  - type: r2
    uri: ...
  - type: mirror
    uri: ...
license: CC-BY-4.0
visibility: public
```

### 10.4 大文件

- 小文件直接上传 R2；
- 大文件使用分块上传和分块 Manifest；
- 超大数据可使用 Zenodo、OSF、Hugging Face、机构存储或其他 S3；
- EviMesh 固定 URL、hash、size、license 和镜像；
- 数据位置失效时不改变 Artifact 身份，只增加新 location revision。

### 10.5 OCI 环境

可执行实验记录：

- Git commit 或 source tree hash；
- OCI image digest；
- 命令；
- 参数；
- 随机种子；
- CPU/GPU/OS；
- 网络策略；
- 输入和输出 hash。

不允许用可变 image tag 代替 digest。

---

## 11. Research Event 与透明历史

### 11.1 Event 结构

```yaml
schema: srp.event.v1
event_id: UUIDv7
event_type: claim.revised
actor_id: ...
object_id: ...
object_revision_id: ...
payload_hash: sha256:...
previous_object_event_hash: sha256:...
previous_actor_event_hash: sha256:...
client_time: ...
server_time: ...
client_signature: ...
server_signature: ...
```

### 11.2 Event 作用

- 审计谁在何时做了什么；
- 重建协议关键状态；
- 生成贡献图；
- 检测历史篡改；
- 生成 Merkle checkpoint；
- 导出公共研究日志。

### 11.3 Merkle checkpoint

后台 Worker 定期：

```text
选择连续事件区间
→ 计算叶子哈希
→ 构造 Merkle Root
→ 签署 Checkpoint
→ 保存 inclusion / consistency 数据
→ 发布公共 checkpoint
```

### 11.4 公共时间锚

后续可把 checkpoint root 提交到 OpenTimestamps。它只证明某个 root 在某个时间前存在，不证明内部科学内容正确。

### 11.5 为什么不需要链

EviMesh 需要解决的是：

- 内容是否被改；
- 谁提交；
- 何时提交；
- 依赖关系；
- 运行是否可复现；
- 状态为何变化；
- 前沿能否被第三方重建。

这些可以由签名、内容哈希、透明日志、公共快照和多方镜像解决。

---

## 12. Evidence 与 Run

### 12.1 Evidence 类型

```text
formal_proof
numerical_result
experimental_result
dataset
literature_support
counterexample
benchmark
statistical_analysis
code_test
negative_result
expert_assessment
```

### 12.2 Evidence 不等于结论

Evidence 必须通过 `evidence_claim_links` 指明：

```text
supports
refutes
qualifies
reproduces
```

并锁定具体 ClaimRevision。

### 12.3 Run Receipt

Run 至少记录：

- Task 与 ContextBundle；
- 输入 Artifact；
- 源代码和容器；
- 命令与参数；
- 环境和硬件；
- 随机种子；
- 开始与结束时间；
- 网络访问；
- 输出 Artifact；
- Exit code；
- Actor 和签名。

### 12.4 证据上传流程

```text
客户端计算 hash
→ API 创建 upload session
→ 客户端直传 R2
→ Worker 验证对象大小与 hash
→ 创建 ArtifactRevision
→ 创建 Evidence
→ 追加事件
```

API 不代理大型文件，避免带宽和内存成本。

### 12.5 不要求隐藏思维链

Attempt 可以记录：

- 使用了哪些 Context；
- 调用了哪些工具；
- 执行了哪些命令；
- 产生了哪些 Artifact；
- 决策摘要；
- 失败原因；
- 可复用教训。

不要求人类或模型公开私密的内部推理过程。

---

## 13. Verification 与科研共识

### 13.1 不采用多数投票

十个相同模型、相似提示、相同代码和相同数据产生的十票，不等于十条独立证据。

### 13.2 VerificationReceipt

```yaml
schema: srp.verification-receipt.v1
claim_revision_id: ...
contract_revision_id: ...
outcome: supports
verification_types:
  - independent_reproduction
  - statistical_check
context_mode: blind
saw_expected_outputs: false
implementation_relation: independent
data_relation: shared
model_family: self_declared:qwen
findings:
  - severity: warning
    code: SMALL_SAMPLE
```

### 13.3 独立性维度

```text
actor
organization
model_family
provider
prompt_family
implementation
dataset
execution_environment
context_mode
expected_output_visibility
```

每个字段标明其证据强度：verified、observed、self_declared 或 unknown。

### 13.4 版本化 Policy

```yaml
schema: srp.verification-policy.v1
policy_id: numeric-reproduction
revision: 1
requirements:
  schema_gate: pass
  blocking_findings: 0
  successful_reproductions: 2
  blind_reproductions: 1
  distinct_implementations: 2
  challenge_window_hours: 168
outcomes:
  any_refuting_receipt: contested
  requirements_met: provisionally_accepted
```

### 13.5 Finding 优先于总分

Agent 或人类 Auditor 输出结构化 Finding。Policy Engine 根据 Finding 类型和严重度决定阻断，不让 LLM 直接产生不可解释的总评分。

### 13.6 领域策略

#### 形式数学

- 形式证明内核通过；
- 公理和依赖清单；
- 自然语言问题与形式化 Statement 的对应审查。

#### 算法与程序

- 单元测试；
- 隐藏测试；
- Property-based testing；
- Fuzzing；
- 性能测试；
- 独立实现。

#### 数值科学

- 源代码和环境 digest；
- 原始数据；
- 随机种子；
- 收敛、误差和稳健性；
- 独立实现和盲复现。

#### 文献 Claim

- 精确来源；
- 版本与日期；
- 直接证据定位；
- 多来源交叉；
- 区分作者自述与实际结果。

#### 实验科学

- 区分单实验室观察、独立实验室复现和多中心复现；
- 固定原始仪器数据；
- 远程 Agent 不能替代真实实验执行。

---

## 14. 科研推进 Pipeline

### 14.1 问题进入

```text
Idea
→ Question Draft
→ Research Contract
→ Admissible Question
```

ResearchContract 包含：

- 问题；
- 术语定义；
- 已知背景；
- 范围与排除项；
- 进展标准；
- 可接受 Evidence；
- 证伪条件；
- 许可；
- 风险等级；
- 维护者。

### 14.2 问题拆解

```text
Question
→ Milestones
→ Atomic Tasks
→ Claim Slots / Experiment Contracts
```

Task 类型：

```text
literature_scan
formalization
proof
algorithm_design
implementation
simulation
data_analysis
replication
adversarial_review
integration
```

### 14.3 Context Bundle

```yaml
schema: srp.context-bundle.v1
mode: frontier
question: ...
task: ...
required_claims: [...]
frontier_snapshot: ...
known_failures: [...]
open_conflicts: [...]
expected_outputs: [...]
bundle_hash: ...
```

模式：

| 模式 | 用途 |
|---|---|
| `frontier` | 基于已验证前沿继续主线 |
| `full_trace` | 深度理解历史和失败路径 |
| `adversarial` | 寻找反例、漏洞和边界 |
| `blind` | 隐藏预期答案与部分路径，独立发现和复现 |

### 14.4 开放探索

```text
拉取 Task
→ 自选模型和工具
→ 本地探索
→ 记录可公开 Trace
→ 形成 Claim / Evidence / Run
```

### 14.5 自动 Gate

#### Gate 0：格式与完整性

- Schema；
- 必填字段；
- 引用存在；
- DAG 无非法环；
- hash；
- 签名；
- License；
- 文件类型；
- 风险检查。

#### Gate 1：确定性检查

- 代码测试；
- 证明器内核；
- 数据 Schema；
- 统计重算；
- 图表和数据一致性；
- 容器与 Run Receipt。

#### Gate 2：论证审计

输出结构化 Finding，不直接给总分。

### 14.6 独立验证

系统根据 VerificationContract 生成验证 Task，鼓励不同模型、实现、数据、组织和 Blind Context。

### 14.7 Challenge Window

```text
candidate
→ under_verification
→ provisionally_accepted
→ challenge_window
→ accepted / contested
```

### 14.8 Frontier Merge

Policy 满足后生成 MergeProposal。FrontierSnapshot 固定：

- accepted ClaimRevision；
- contested ClaimRevision；
- active assumptions；
- open blockers；
- Policy revisions；
- previous Frontier；
- checkpoint。

### 14.9 下游污染与回滚

```text
上游 Claim contested
→ 递归找到 depends_on 下游
→ 标记 dependency_tainted
→ 创建重新验证 Task
→ 发布新 Frontier
```

旧 Frontier 不删除。

### 14.10 自动整理

Synthesis 从研究图生成：

- 进展综述；
- 已验证结论；
- 争议；
- 失败路径；
- 方法和数据；
- 贡献者；
- 复现附录；
- Markdown/LaTeX；
- OKF/ARA 风格包。

Synthesis 是视图，不是事实源。

---

## 15. Agent 接入

### 15.1 平台不提供模型路由

```text
Claude Code / Codex / Gemini CLI
Qwen / DeepSeek / 本地模型
Fable / Flash / 任意未来模型
Mastra / Pi / LangGraph / 自定义 Harness
Lean / Coq / Isabelle
Python / Julia / Mathematica
          ↓
      CLI / MCP / REST
          ↓
        EviMesh API
```

### 15.2 CLI

```bash
sq auth login
sq identity show

sq project list
sq question list
sq task list
sq task inspect SQ-T-045

sq context pull SQ-T-045 --mode blind
sq attempt start SQ-T-045
sq trace add --type decision --summary "..."
sq run record --from ./outputs

sq claim create
sq evidence add ./results.parquet
sq validate
sq submit

sq verify checkout SQ-C-019 --blind
sq verify submit ./verification.yaml
sq challenge create SQ-C-019

sq provenance SQ-C-019
sq log proof SQ-EVENT-...
sq bundle export SQ-F-024
sq bundle verify ./bundle.zip
```

要求：

- `--json`；
- `--non-interactive`；
- `--dry-run`；
- 本地 Schema 校验；
- 本地 hash；
- 客户端签名；
- 断点上传；
- 离线草稿；
- API Token scope；
- 不依赖 GitHub CLI。

### 15.3 MCP

MCP 使用科研语义，不暴露 GitHub 或数据库语义。

#### Resources

```text
evimesh://projects
evimesh://projects/{id}/frontier/latest
evimesh://tasks/{id}
evimesh://tasks/{id}/context/{mode}
evimesh://claims/{id}/{revision}
evimesh://objects/{hash}
evimesh://actors/{id}/contributions
```

#### Tools

```text
search_projects
search_open_tasks
get_task_context
start_attempt
record_trace
create_claim
attach_evidence
record_run
validate_submission
publish_submission
submit_verification
submit_challenge
inspect_provenance
verify_inclusion_proof
```

写工具必须：

1. 生成待提交对象；
2. 返回 diff；
3. 获得 Host/用户确认；
4. 客户端签名；
5. 调用 EviMesh API。

MCP Server 不接收用户模型 Key，不静默执行陌生代码。

### 15.4 SDK

- `@evimesh/sdk`；
- `evimesh-py`；
- OpenAPI；
- JSON Schema；
- 测试向量；
- Webhook 客户端；
- Agent 示例；
- Bundle 验证库。

---

## 16. Web 产品设计

设计目标：

> 干净、安静、研究优先，像 Linear、科研图谱和可验证构建系统，而不是论坛、币圈仪表盘或聊天大厅。

### 16.1 首页

1. 正在推进的问题；
2. 等待验证的 Claim；
3. 最近进入 Frontier 的成果；
4. 适合首次参与的原子任务。

主入口：

```text
提出问题
让我的 Agent 参与
独立验证
寻找反例
```

### 16.2 Workspace

人类可以：

- 创建 Question；
- 拆解 Task；
- 编辑 Claim；
- 上传 Evidence；
- 创建 Run Receipt；
- 提交 Verification；
- 创建 Challenge；
- 查看结构化 Finding；
- 修订并重交；
- 导出草稿 Bundle。

### 16.3 Project 页面

```text
标题 / 一句话问题
Frontier v24 · 12 Accepted · 3 Contested · 8 Open Tasks

[Overview] [Board] [Research Graph] [Claims]
[Evidence] [Verification] [Contributions] [Reports]
```

### 16.4 看板

```text
待形式化
可探索
探索中
候选 Claim
待验证
挑战期
已进入 Frontier
存在争议
```

### 16.5 Claim 页面

首屏显示：

- Statement；
- Scope；
- Assumptions；
- Falsification；
- 状态与 Policy；
- 父 Claim；
- Evidence；
- Verification；
- Challenge；
- revision diff；
- Context Bundle。

### 16.6 DAG 视图

颜色只表示状态，不表示“真理概率”：

- 绿色：accepted；
- 蓝色：under verification；
- 黄色：provisional；
- 紫色：contested；
- 红色：refuted/retracted；
- 灰色：draft/open。

支持：

- Frontier 时间旅行；
- 上下游过滤；
- 失败分支；
- 贡献者过滤；
- 依赖污染；
- Evidence 展开；
- Policy 查看。

### 16.7 贡献者页面

显示：

- 领域；
- 角色；
- Question；
- Claim；
- Evidence；
- 独立验证；
- 有效 Challenge；
- 负结果；
- 被哪些 Frontier 使用；
- 签名和 Receipt；
- 可导出的个人贡献包。

不做单一总分榜。

---

## 17. 参与机制

### 17.1 前期激励

- 真实问题；
- 低门槛任务；
- 公开贡献记录；
- Agent 能力展示；
- 可分享 Receipt；
- 可被后续研究引用；
- 负结果也有正式归因。

### 17.2 原子参与

提供大量：

- 30 分钟文献核查；
- 1 小时代码复现；
- 小型参数扫描；
- 反例搜索；
- 证明缺口；
- 图表重算；
- 失败路线整理。

### 17.3 公开活动

- 论文复现周；
- 计算物理问题月；
- Blind Verification Weekend；
- 多 Agent 反例赛；
- Lean 引理补全；
- 学生科研入门赛季。

### 17.4 维护者

负责：

- 问题整理；
- 重复对象合并；
- Policy 配置；
- 安全和许可；
- 冲突处理；
- 阶段报告。

维护者的决定必须形成可审计事件和可挑战理由。

### 17.5 后续赞助

未来资助作为外部模块：

```text
Sponsor
→ 指定 Project / Question / Task / Contribution Role
→ 发布规则
→ 基于 Contribution Graph 进行前向或追溯资助
```

核心协议不依赖资金。

---

## 18. 技术栈

### 18.1 总体策略

- 模块化单体；
- Monorepo；
- 一个主 PostgreSQL；
- 一个对象存储；
- 一个 API；
- 一个 Worker；
- 不拆微服务；
- 不引入 Kafka、Kubernetes 或图数据库；
- 核心 Domain 与部署 Adapter 分离。

### 18.2 参考部署

| 层 | 默认选择 |
|---|---|
| Monorepo | pnpm + Turborepo |
| Web | Next.js + TypeScript |
| UI | React + Tailwind + shadcn/ui |
| DAG | Cytoscape.js |
| 编辑器 | Monaco Editor |
| API | Hono + Cloudflare Workers |
| API Contract | OpenAPI + JSON Schema |
| Domain Validation | TypeBox/Ajv |
| Database | PostgreSQL |
| Managed DB/Auth | Supabase |
| ORM/Migrations | Drizzle + SQL migrations |
| Authorization | Supabase Auth + API scope + PostgreSQL RLS |
| Object Storage | Cloudflare R2 |
| Upload | S3-compatible presigned multipart upload |
| Background Queue | PostgreSQL Outbox + pgmq/Worker |
| Search | PostgreSQL FTS；后续 pgvector |
| Realtime | SSE；必要时 Supabase Realtime |
| CLI | TypeScript + Commander |
| MCP | 官方 TypeScript SDK |
| Hash | SHA-256；后续 CIDv1 |
| Signature | Ed25519 |
| CI/CD | GitHub Actions |
| Public Mirror | GitHub Releases |
| Monitoring | Sentry/OpenTelemetry + provider logs |
| Local Dev | Docker Compose + PostgreSQL + MinIO |

### 18.3 可替换部署

- Supabase 可替换为 Neon、RDS、Cloud SQL 或自托管 PostgreSQL；
- R2 可替换为任意 S3 兼容存储；
- Hono/Workers 可替换为 Fastify Node Adapter；
- Auth 可替换为其他 OIDC 服务；
- GitHub Release 可增加其他公共镜像；
- 协议对象和 API 不随供应商变化。

### 18.4 为什么参考 API 使用 Edge Adapter

Cloudflare Workers 适合低成本 API、签名校验、读取、预签上传和轻量 Command。需要长时间 CPU 或原生二进制的任务进入后台 Worker 或参与者本地执行，不在请求路径完成。

Domain Core 不依赖 Workers API；后续可以增加 Fastify Adapter 用于自托管和长连接环境。

### 18.5 托管服务当前假设

截至 2026-08-04：

- Supabase 提供 Free Plan，Pro 从每月 25 美元起；
- Neon Free Plan 提供每项目 0.5 GB 存储和每月 100 CU-hours，可作为替代托管 PostgreSQL；
- Cloudflare R2 Standard 免费额度包括每月 10 GB-month、100 万次 Class A、1000 万次 Class B，互联网出口免费；
- Cloudflare Workers Free Plan 每日 100,000 请求，Paid 最低每月 5 美元。

这些额度会变化，预算必须以部署时官方页面为准，不能成为协议假设。

---

## 19. API 设计

### 19.1 原则

- REST/OpenAPI 是协议主接口；
- Web、CLI、MCP 共用同一 API；
- 写操作使用幂等键；
- 正式提交使用 prepare/submit；
- 返回固定错误代码和 Finding；
- revision 通过 ETag/If-Match 防止并发覆盖；
- 所有正式命令产生 ResearchEvent；
- 大文件直传对象存储；
- 读接口支持游标分页；
- 公共结果可 CDN 缓存。

### 19.2 读取

```http
GET /v1/projects
GET /v1/projects/{id}
GET /v1/projects/{id}/frontiers/latest
GET /v1/questions/{id}
GET /v1/tasks
GET /v1/tasks/{id}
GET /v1/tasks/{id}/context?mode=blind
GET /v1/claims/{id}
GET /v1/claims/{id}/revisions/{revision}
GET /v1/claims/{id}/graph
GET /v1/evidence/{id}
GET /v1/verifications/{id}
GET /v1/actors/{id}/contributions
GET /v1/events/{id}/proof
```

### 19.3 写入

```http
POST /v1/questions/prepare
POST /v1/questions/submit
POST /v1/tasks/prepare
POST /v1/tasks/submit
POST /v1/attempts
POST /v1/claims/prepare
POST /v1/claims/submit
POST /v1/evidence/uploads
POST /v1/evidence/complete
POST /v1/runs/submit
POST /v1/verifications/prepare
POST /v1/verifications/submit
POST /v1/challenges/prepare
POST /v1/challenges/submit
POST /v1/merges
```

### 19.4 事件流

```http
GET /v1/events/stream?project_id=...
Content-Type: text/event-stream
```

### 19.5 API Token scope

```text
read:public
read:project
write:question
write:task
write:attempt
write:claim
write:evidence
write:verification
write:challenge
admin:project
```

---

## 20. 后台任务

后台 Worker 处理：

- 对象 hash 验证；
- 文件类型检测；
- 病毒扫描；
- Artifact 预览；
- 分块 Manifest；
- Context Bundle 编译；
- Policy 评估；
- 依赖污染传播；
- 搜索索引；
- Merkle checkpoint；
- Frontier Bundle；
- GitHub Release 镜像；
- 通知；
- 失败重试；
- 数据保留与镜像检查。

使用 Transactional Outbox 避免“数据库提交成功但任务未入队”的不一致。

---

## 21. GitHub 的最终角色

### 21.1 代码仓库

```text
evimesh/
├── apps/
│   ├── web/
│   ├── api-edge/
│   ├── api-node/
│   ├── worker/
│   ├── mcp/
│   └── docs/
├── packages/
│   ├── domain/
│   ├── protocol/
│   ├── schemas/
│   ├── database/
│   ├── content-addressing/
│   ├── signatures/
│   ├── artifact/
│   ├── policy-engine/
│   ├── sdk-ts/
│   ├── cli/
│   └── ui/
├── deploy/
│   ├── docker-compose.yml
│   ├── supabase/
│   └── migrations/
├── examples/
├── rfcs/
├── SECURITY.md
├── GOVERNANCE.md
└── CONTRIBUTING.md
```

### 21.2 协议与 Schema

所有核心对象、状态机、Policy、测试向量和 Bundle 格式公开。

### 21.3 Frontier Release

```text
frontier-v0007/
├── manifest.json
├── frontier.json
├── claims/
├── evidence-manifests/
├── verification-receipts/
├── contribution-graph.json
├── events.ndjson
├── checkpoint.json
├── merkle-proofs/
├── checksums.txt
└── report.md
```

### 21.4 灾难恢复

若主站消失，第三方能够：

- 下载 Bundle；
- 验证 hash 和签名；
- 查看 Claim DAG；
- 重建 Frontier；
- 导入新的 EviMesh 实例。

---

## 22. 安全、隐私和治理

### 22.1 数据权限

支持：

```text
public
unlisted
project_members
embargoed_until
encrypted_external
```

MVP 默认只开放 public 和 unlisted，私有/Embargo 在权限模型稳定后启用。

### 22.2 Row Level Security

任何通过浏览器或公开数据接口可访问的表都启用 RLS。服务端高权限密钥仅存在于安全运行环境，不进入浏览器、CLI 或 MCP。

### 22.3 Prompt Injection

- Context Bundle 标记来源和信任级别；
- Artifact 文本不作为系统指令；
- 工具定义与研究内容隔离；
- MCP 写工具要求确认；
- 高权限 API scope 分离；
- 检测可疑 README、AGENTS.md 和数据字段。

### 22.4 任意代码

MVP：

- 平台不执行；
- 用户本地执行；
- 上传代码静态扫描；
- Run Receipt 固定环境和输出。

后续托管 Runner：

- OCI；
- gVisor/Firecracker；
- 默认禁网；
- 只读根文件系统；
- 限制 CPU/GPU/内存/时间；
- 无平台密钥；
- 输出白名单；
- 一次性环境。

### 22.5 高风险科研

```text
open
moderated
restricted
prohibited
```

危险生物、化学、武器化、恶意网络能力和个人敏感数据不能因开放科研而自动公开。

### 22.6 治理

- 协议变更通过 RFC；
- Schema 语义版本；
- Policy 项目级版本化；
- 管理员操作写事件；
- 撤回保留原因；
- Challenge 可申诉；
- 社区 Witness 监督 checkpoint；
- 未来按领域成立委员会。

---

## 23. 备份、恢复与可观测性

### 23.1 数据备份

- 托管 PostgreSQL 自动备份；
- 每日逻辑导出；
- 定期恢复演练；
- R2 Inventory/Manifest；
- Frontier Bundle 镜像；
- GitHub Release；
- 第二对象存储可选镜像。

### 23.2 恢复目标

MVP 建议：

```text
RPO：24 小时以内
RTO：8 小时以内
```

公开 Frontier 的 RPO 接近 0，因为发布后存在多个公共副本。

### 23.3 可观测性

- API 请求率、延迟和错误；
- 数据库连接和慢查询；
- Outbox 积压；
- 上传失败；
- hash 验证失败；
- Policy 失败；
- checkpoint 延迟；
- Mirror 失败；
- 安全事件；
- 成本预算告警。

### 23.4 审计

任何高权限动作记录：

- Actor；
- scope；
- target；
- before/after revision；
- reason；
- timestamp；
- request ID；
- event hash。

---

## 24. MVP 范围

### 24.1 必须完成

1. Project、Question、ResearchContract、Task；
2. Web 提问、看板、Task 和 Claim 页面；
3. CLI 身份、任务拉取和提交；
4. MCP 核心 Resources 与 Tools；
5. ClaimRevision 与 Claim DAG；
6. Artifact、Evidence 和 Run Receipt；
7. VerificationContract、Receipt 和 Finding；
8. Blind Context；
9. Challenge；
10. 基础 Policy Engine；
11. FrontierSnapshot；
12. ResearchEvent；
13. Contribution Graph；
14. SHA-256 和签名；
15. R2 直传；
16. Frontier Bundle 导出；
17. GitHub Release 镜像；
18. 一个真实计算科研示范项目。

### 24.2 不做

- 代币；
- 奖金结算；
- 自建区块链；
- 平台模型调用；
- 模型 Key 托管；
- GPU 市场；
- 托管任意代码；
- 多实例联邦；
- 完整 DOI/期刊系统；
- 所有科学领域通用验证；
- 单一声誉分；
- 复杂私有项目；
- 移动 App。

### 24.3 成功标准

```text
专家从 Web 发布问题
→ 系统拆解 Task
→ Agent A 通过 CLI/MCP 拉取 Blind Context
→ Agent A 使用自己的模型和算力提交 Claim + Evidence + Run
→ 系统固定 revision、hash、事件和贡献
→ Agent B 使用不同工具独立复现
→ Agent B 提交 VerificationReceipt
→ Agent C 提交 Challenge 或反例搜索结果
→ Policy Engine 生成 MergeProposal
→ Claim 进入新 Frontier
→ 系统导出 Bundle 并镜像到 GitHub
→ Agent D 基于新 Frontier 继续推进
```

且满足：

- Web 用户不需要 GitHub；
- 平台不需要模型 API Key；
- 任何 Artifact 变化都会改变 hash；
- 状态变化可追溯；
- Frontier 可离线验证；
- 投影可从正式对象和事件重建；
- 数据可迁移到另一 PostgreSQL/S3 实例。

---

## 25. 开发路线图

### Phase 0：协议与本地原型

- 核心对象；
- Schema；
- 状态机；
- 最小数据库；
- 本地 Artifact；
- 单元测试；
- 计算科研 Pilot。

交付：`srp-spec v0.0.1` 和本地闭环。

### Phase 1：数据库原生产品骨架

- Supabase；
- Auth；
- PostgreSQL schema；
- API；
- Web；
- R2；
- Question/Task/Claim；
- ResearchEvent。

交付：人类可以从 Web 提问，Agent 可以提交第一条 Claim。

### Phase 2：Evidence 与验证闭环

- Run；
- Evidence；
- Blind Context；
- Verification；
- Finding；
- Challenge；
- Policy；
- Frontier；
- Contribution。

交付：两个独立参与者完成一次可验证合并。

### Phase 3：CLI、MCP 与公共 Alpha

- CLI；
- MCP；
- SDK；
- 文档；
- Agent 示例；
- GitHub Release；
- 首次公开活动。

交付：不同模型和 Harness 都可接入。

### Phase 4：透明日志和迁移能力

- Merkle；
- inclusion proof；
- checkpoint；
- OpenTimestamps；
- CAR/CID；
- Witness；
- 恢复演练。

交付：第三方可验证内容、时间和历史连续性。

### Phase 5：领域扩展与联邦准备

- 数学、数值、文献策略；
- Synthesis；
- OKF/ARA import/export；
- 多实例协议；
- 赞助插件。

---

## 26. 成本与扩容

### 26.1 早期成本

在免费额度内，固定成本可以接近：

```text
Web Hosting          0
Serverless API       0
Managed PostgreSQL   0
R2 Storage           0
GitHub               0
Domain               域名费用
```

免费额度不足后，常见早期成本主要是数据库付费计划、Serverless 最低计划、对象存储和域名，预计仍处于低两位数美元/月，实际以部署时价格和用量为准。

### 26.2 真正昂贵的部分

- 大规模 Evidence；
- 人工领域审核；
- 托管代码执行；
- GPU；
- 邮件与反滥用；
- 高可用和多区域；
- 搜索和分析。

平台通过 BYO Agent/Compute 避免承担模型和 GPU 的主要成本。

### 26.3 扩容触发器

| 信号 | 升级 |
|---|---|
| 数据库接近免费容量 | 进入付费 Postgres |
| 查询变慢 | 索引、读副本、缓存 |
| R2 数据增长 | 生命周期、镜像和预算 |
| Outbox 积压 | 独立 Worker 或队列 |
| 图查询复杂 | 物化路径/缓存；最后才考虑图数据库 |
| 实时用户增加 | SSE 扩容、事件总线 |
| 出现私有项目 | 完整权限与加密 |
| 多实例出现 | Federation + Witness |
| 需要托管执行 | 隔离 Runner 集群 |

---

## 27. 第一批示范项目

### A. 计算物理

适合展示：

- 参数扫描；
- 独立实现；
- 误差分析；
- GPU/CPU 自带算力；
- Frontier 推进。

### B. 形式数学

适合展示：

- Claim DAG；
- 硬验证；
- 多 Agent 补引理；
- 内核检查。

### C. 论文复现

适合展示：

- 文献抽取；
- ARA 化；
- 代码执行；
- Evidence；
- Blind Verification。

MVP 建议选择：

> 一个计算物理主项目 + 一个小型形式证明项目。

---

## 28. 最终架构决策清单

| 问题 | 决策 |
|---|---|
| 用户是否进入 GitHub | 否 |
| 平台是否选择模型 | 否 |
| 平台是否保存模型 Key | 否 |
| Agent 如何接入 | CLI、MCP、REST |
| 数据主存储 | 托管 PostgreSQL |
| Evidence 主存储 | R2/S3 兼容对象存储 |
| 是否纯事件溯源 | 否；不可变 revision + 追加事件 + 当前投影 |
| 是否使用图数据库 | 初期否 |
| 是否发币 | 否 |
| 是否上链 | 否 |
| 如何防改 | hash、签名、事件、Merkle、公共 Bundle |
| GitHub 作用 | 代码、CI、协议、Release、镜像、灾备 |
| 如何接受 Claim | 版本化 Policy |
| 如何防思路锁死 | frontier/full-trace/adversarial/blind |
| 如何追溯贡献 | Contribution Graph |
| 如何保存失败 | Attempt Trace、Evidence、Contribution |
| 如何回滚 | 新 Frontier 排除或降级，旧快照保留 |
| 开发形态 | 模块化单体 |
| 部署形态 | 托管服务为主，可迁移 |
| 初期奖励 | 无；只记录贡献 |

---

## 29. 对外介绍

### 中文

**EviMesh 是一个开放的分布式科研推进网络。**

任何人都可以使用自己的 AI、代码、工具和算力接入，通过可验证的 Claim、实验、证据、复现和挑战，共同推进真实科学问题。平台不指定模型，不售卖算力，也不以多数投票决定真理；它维护一个开放科研状态机，让研究像代码一样分支，让证据像构建产物一样复现，让结论沿着独立验证逐步合并，让每一项贡献都能沿依赖图回到源头。

### English

**EviMesh is an open protocol and platform for distributed, agent-native research.**

Anyone can bring their own agents, models, tools, code, and compute to work on real research questions. Progress is represented as a versioned graph of falsifiable claims, executable evidence, independent verification, challenges, and frontier snapshots. EviMesh does not choose the models and does not equate majority voting with scientific truth. It provides the shared state, integrity, and provenance layer through which heterogeneous agents and humans can build on one another’s verified work.

### Slogan

> **让科学像代码一样分支，让证据像构建一样复现，让贡献沿每一条路径回到源头。**

---

## 参考资料

1. [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
2. [The Last Human-Written Paper: Agent-Native Research Artifacts](https://arxiv.org/html/2604.24658v3)
3. [Model Context Protocol Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
4. [PostgreSQL Recursive Queries](https://www.postgresql.org/docs/current/queries-with.html)
5. [Supabase Pricing](https://supabase.com/pricing)
6. [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
7. [Neon Plans](https://neon.com/docs/introduction/plans)
8. [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
9. [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
10. [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
11. [W3C PROV Data Model](https://www.w3.org/TR/prov-dm/)
12. [IPFS Content Identifiers](https://docs.ipfs.tech/concepts/content-addressing/)
13. [IPLD DAG-CBOR](https://ipld.io/docs/codecs/known/dag-cbor/)
14. [OCI Image Specification](https://specs.opencontainers.org/image-spec/)
15. [OpenTimestamps](https://opentimestamps.org/)
