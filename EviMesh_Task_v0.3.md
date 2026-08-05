# EviMesh Task：数据库原生版完整原子任务表

> 本任务表对应《EviMesh Roadmap：开放分布式科研推进网络 v0.3》。
> 架构主线：自建产品与数据模型，采用托管 PostgreSQL/Auth、托管对象存储和 Serverless API；GitHub 只用于代码、CI、协议、Release、镜像与灾备。

- 文档版本：v0.3
- 日期：2026-08-04
- 任务粒度：绝对原子化
- 单任务最大规模：不超过 1 个工程日
- 任务用途：可直接转换为 GitHub Issues、Linear Tasks 或其他项目管理条目
- 本文不重复完整项目架构；架构与产品说明见独立项目计划书

---

## 0. 原子化规则

每个任务必须同时满足：

1. 只有一个主要动作；
2. 只有一个主要交付物；
3. 只有一个可独立判断的验收结果；
4. 不使用“实现某模块全部功能”这类复合表述；
5. 数据表、约束、服务、端点、页面、测试和部署分别建任务；
6. 任务不能依赖未列出的隐含工作；
7. 超过一个工程日的工作必须继续拆分；
8. 完成任务不代表完成里程碑，必须满足里程碑出口条件；
9. P0 是闭环阻断项，P1 是公开 Alpha 必需项，P2 是可延后增强项；
10. Size 定义：

| Size | 预计工作量 |
|---|---|
| `XS` | 0.5–2 小时 |
| `S` | 2–4 小时 |
| `M` | 4–8 小时 |

---

## 1. 使用方式

推荐将每行创建为一个任务，字段映射：

```text
Title        ← 原子任务
Milestone    ← 所在章节
Area         ← Area
Priority     ← Priority
Estimate     ← Size
Blocked by   ← 依赖
Definition of Done ← 验收标准
Artifact     ← 交付物
```

只有验收标准被实际验证后，任务才能关闭。

---

## M0：项目边界、仓库与治理

**里程碑目标：** 建立可开发、可审查、可发布的工程与治理基础。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M0-01 | architecture | 冻结数据库原生架构决策 | ADR-0001 | ADR 明确 PostgreSQL 为运行时主状态，GitHub 仅为代码与公共镜像 | - | P0 | S |
| M0-02 | architecture | 冻结模块化单体决策 | ADR-0002 | ADR 明确 MVP 不拆微服务 | M0-01 | P0 | XS |
| M0-03 | architecture | 冻结托管服务可替换原则 | ADR-0003 | ADR 列出 PostgreSQL、S3、API Runtime 的替换边界 | M0-01 | P0 | S |
| M0-04 | architecture | 冻结 BYO Agent/Compute 原则 | ADR-0004 | ADR 明确平台不调用模型且不保存模型 Key | M0-01 | P0 | XS |
| M0-05 | architecture | 冻结无代币原则 | ADR-0005 | ADR 明确 MVP 无代币、积分经济和自动奖金 | M0-01 | P0 | XS |
| M0-06 | repo | 创建 GitHub Organization | 公开组织 | 组织主页可访问 | - | P0 | XS |
| M0-07 | repo | 创建公开主仓库 | evimesh 仓库 | 默认分支为 main | M0-06 | P0 | XS |
| M0-08 | repo | 初始化 pnpm workspace | pnpm-workspace.yaml | pnpm install 成功 | M0-07 | P0 | S |
| M0-09 | repo | 初始化 Turborepo 配置 | turbo.json | turbo run lint 可执行 | M0-08 | P0 | S |
| M0-10 | repo | 创建 apps 目录骨架 | apps/web api-edge api-node worker mcp docs | 所有目录含占位 README | M0-08 | P0 | S |
| M0-11 | repo | 创建 packages 目录骨架 | domain protocol schemas database signatures artifact policy-engine sdk-ts cli ui | 所有目录含 package.json | M0-08 | P0 | S |
| M0-12 | license | 添加 Apache-2.0 代码许可证 | LICENSE | 许可证文本存在 | M0-07 | P0 | XS |
| M0-13 | license | 添加协议文档许可说明 | LICENSE-DOCS.md | 明确协议文档许可 | M0-07 | P0 | XS |
| M0-14 | license | 添加用户研究内容许可政策 | RESEARCH-CONTENT-LICENSE.md | 列出允许的内容许可与未知许可处理 | M0-07 | P0 | S |
| M0-15 | governance | 添加 CONTRIBUTING.md | 贡献指南 | 包含代码、协议和研究示例贡献路径 | M0-07 | P1 | S |
| M0-16 | governance | 添加 CODE_OF_CONDUCT.md | 社区准则 | 包含举报入口 | M0-07 | P1 | XS |
| M0-17 | security | 添加 SECURITY.md | 安全政策 | 包含私密漏洞报告方式 | M0-07 | P0 | S |
| M0-18 | governance | 添加 GOVERNANCE.md | 治理规则 | 定义维护者、RFC、申诉与移交 | M0-15 | P1 | M |
| M0-19 | repo | 配置 CODEOWNERS | CODEOWNERS | 协议、数据库、安全目录均有 owner | M0-07 | P1 | XS |
| M0-20 | repo | 启用 main 分支保护 | 保护规则 | 禁止 force push 和直接 push | M0-07 | P0 | XS |
| M0-21 | ci | 创建占位 CI Workflow | ci.yml | PR 上显示通过的 placeholder check | M0-08 | P0 | S |
| M0-22 | planning | 建立工程 Label 集 | Labels | type/area/priority/status 标签完整 | M0-07 | P1 | S |
| M0-23 | planning | 创建 MVP Project Board | GitHub Project | 新 Issue 可加入 Backlog | M0-22 | P1 | S |

**本里程碑任务数：23**

## M1：协议对象、状态机与 Schema

**里程碑目标：** 冻结所有核心科研对象和可机器校验的协议边界。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M1-01 | protocol | 定义对象 ID 格式 | ID 规范 | Project/Question/Task/Claim/Evidence/Run/Verification/Frontier 均有前缀 | M0-01 | P0 | S |
| M1-02 | protocol | 定义 UUIDv7 使用规则 | ID 生成规范 | 服务器与客户端 ID 冲突规则明确 | M1-01 | P0 | S |
| M1-03 | protocol | 定义 revision 语义 | revision 规范 | 明确新 revision、supersede 与禁止覆盖 | M1-01 | P0 | S |
| M1-04 | protocol | 定义 hash 语义 | hash 规范 | 区分 raw_hash 与 semantic_hash | M1-03 | P0 | S |
| M1-05 | protocol | 定义 Actor 类型枚举 | Actor 规范 | human/agent/organization/service/maintainer/witness 可校验 | M1-01 | P0 | XS |
| M1-06 | protocol | 定义身份强度枚举 | Identity 规范 | verified/observed/self_declared/unknown 可校验 | M1-05 | P0 | XS |
| M1-07 | protocol | 定义 Project 状态枚举 | Project 状态机 | 状态迁移表完整 | M1-01 | P1 | XS |
| M1-08 | protocol | 定义 Question 状态机 | Question 状态机 | 非法迁移清单完整 | M1-01 | P0 | S |
| M1-09 | protocol | 定义 Task 状态机 | Task 状态机 | open/active/blocked/completed/cancelled 迁移完整 | M1-01 | P0 | S |
| M1-10 | protocol | 定义 Attempt 状态机 | Attempt 状态机 | active/paused/submitted/abandoned 迁移完整 | M1-01 | P0 | XS |
| M1-11 | protocol | 定义 Claim 状态机 | Claim 状态机 | candidate 到 accepted/contested/refuted 等迁移完整 | M1-03 | P0 | M |
| M1-12 | protocol | 定义 Challenge 状态机 | Challenge 状态机 | open 到 upheld/rejected/resolved 迁移完整 | M1-01 | P0 | S |
| M1-13 | protocol | 定义 Frontier 不可变规则 | Frontier 规范 | 每个快照必须引用 previous 和固定 revision | M1-03 | P0 | S |
| M1-14 | protocol | 定义 ClaimRelation 枚举 | Relation 规范 | 全部关系的方向和语义明确 | M1-01 | P0 | M |
| M1-15 | protocol | 定义 depends_on 无环规则 | DAG 约束 | 给出合法和非法样例 | M1-14 | P0 | S |
| M1-16 | protocol | 定义 Evidence 类型枚举 | Evidence 规范 | formal/numerical/experimental 等类型完整 | M1-01 | P0 | S |
| M1-17 | protocol | 定义 Evidence-Claim 关系枚举 | Evidence Link 规范 | supports/refutes/qualifies/reproduces 可校验 | M1-16 | P0 | XS |
| M1-18 | protocol | 定义 Run Receipt 最小字段 | Run 规范 | 输入、环境、命令、种子、输出字段完整 | M1-04 | P0 | M |
| M1-19 | protocol | 定义 VerificationReceipt 最小字段 | Verification 规范 | outcome/context/independence/findings 字段完整 | M1-11,M1-18 | P0 | M |
| M1-20 | protocol | 定义 Finding 严重度枚举 | Finding 规范 | critical/major/warning/note 语义明确 | M1-19 | P0 | XS |
| M1-21 | protocol | 定义 VerificationPolicy 结构 | Policy 规范 | requirements/outcomes/version 字段完整 | M1-19 | P0 | M |
| M1-22 | protocol | 定义 ContextBundle 模式 | Context 规范 | frontier/full_trace/adversarial/blind 定义明确 | M1-08,M1-11 | P0 | S |
| M1-23 | protocol | 定义 Contribution 角色枚举 | Contribution 规范 | originator 到 maintainer 角色完整 | M1-05 | P0 | S |
| M1-24 | protocol | 定义 ResearchEvent Envelope | Event 规范 | event_type/payload/hash/signature/parents 字段完整 | M1-02,M1-04 | P0 | M |
| M1-25 | protocol | 定义客户端签名 Envelope | Signature 规范 | 签名覆盖字节与 nonce 规则明确 | M1-24 | P0 | M |
| M1-26 | protocol | 定义 Platform Receipt | Receipt 规范 | server_time/event_id/server_signature 字段完整 | M1-24 | P0 | S |
| M1-27 | schema | 创建 common JSON Schema | common.schema.json | 合法测试向量通过 | M1-01:M1-06 | P0 | M |
| M1-28 | schema | 创建 Project JSON Schema | project.schema.json | 合法和非法样例结果符合预期 | M1-07,M1-27 | P0 | S |
| M1-29 | schema | 创建 Question JSON Schema | question.schema.json | ResearchContract 引用可校验 | M1-08,M1-27 | P0 | M |
| M1-30 | schema | 创建 Task JSON Schema | task.schema.json | 输入、输出、验收、context_mode 可校验 | M1-09,M1-27 | P0 | M |
| M1-31 | schema | 创建 Claim JSON Schema | claim.schema.json | statement/scope/assumptions/falsification 可校验 | M1-11,M1-14,M1-27 | P0 | M |
| M1-32 | schema | 创建 Artifact JSON Schema | artifact.schema.json | hash/location/license 可校验 | M1-04,M1-16,M1-27 | P0 | M |
| M1-33 | schema | 创建 Run JSON Schema | run.schema.json | 最小 Run 样例通过 | M1-18,M1-27 | P0 | M |
| M1-34 | schema | 创建 Verification JSON Schema | verification.schema.json | 固定 ClaimRevision 和 Finding 可校验 | M1-19:M1-21,M1-27 | P0 | M |
| M1-35 | schema | 创建 Challenge JSON Schema | challenge.schema.json | 目标 revision 与 impact 可校验 | M1-12,M1-27 | P0 | M |
| M1-36 | schema | 创建 Frontier JSON Schema | frontier.schema.json | previous/member/policy/checkpoint 可校验 | M1-13,M1-27 | P0 | M |
| M1-37 | schema | 创建 Contribution JSON Schema | contribution.schema.json | produced/used/role 可校验 | M1-23,M1-27 | P0 | M |
| M1-38 | schema | 创建 Event JSON Schema | event.schema.json | 签名和父事件字段可校验 | M1-24:M1-26,M1-27 | P0 | M |
| M1-39 | test | 创建协议合法测试向量 | valid fixtures | 每个 Schema 至少一个合法样例 | M1-28:M1-38 | P0 | M |
| M1-40 | test | 创建协议非法测试向量 | invalid fixtures | 每个 Schema 至少两个失败样例 | M1-39 | P0 | M |

**本里程碑任务数：40**

## M2：托管基础设施与本地环境

**里程碑目标：** 建立可迁移的 Supabase、R2、Serverless 和本地开发环境。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M2-01 | infra | 创建 Supabase 开发项目 | 开发数据库 | 项目可连接 | M0-07 | P0 | S |
| M2-02 | infra | 创建 Supabase 预发布项目 | 预发布数据库 | 项目与开发环境隔离 | M2-01 | P1 | S |
| M2-03 | infra | 创建 Supabase 生产项目 | 生产数据库 | 生产密钥未进入代码仓库 | M2-02 | P1 | S |
| M2-04 | infra | 创建 R2 开发 Bucket | 开发对象存储 | S3 API 可列出 Bucket | M0-07 | P0 | S |
| M2-05 | infra | 创建 R2 预发布 Bucket | 预发布对象存储 | 与开发 Bucket 隔离 | M2-04 | P1 | XS |
| M2-06 | infra | 创建 R2 生产 Bucket | 生产对象存储 | 公开访问默认关闭 | M2-05 | P1 | XS |
| M2-07 | infra | 创建 Cloudflare Workers 开发项目 | 开发 API Runtime | 健康检查可访问 | M0-07 | P0 | S |
| M2-08 | infra | 创建 Cloudflare Workers 预发布环境 | 预发布 Runtime | 使用独立环境变量 | M2-07 | P1 | S |
| M2-09 | infra | 创建 Cloudflare Workers 生产环境 | 生产 Runtime | 生产 Secret 仅在平台保存 | M2-08 | P1 | S |
| M2-10 | infra | 创建 Web 托管开发项目 | Web Preview | PR 可生成预览 URL | M0-10 | P0 | S |
| M2-11 | infra | 创建 Web 生产项目 | Web Production | main 可部署到生产域名 | M2-10 | P1 | S |
| M2-12 | infra | 配置开发域名 | dev 子域名 | HTTPS 可访问 | M2-07,M2-10 | P1 | XS |
| M2-13 | infra | 配置 API 生产域名 | api 子域名 | HTTPS 可访问健康检查 | M2-09 | P1 | XS |
| M2-14 | infra | 配置 R2 CORS 开发策略 | CORS 规则 | 仅允许开发 Web Origin 上传 | M2-04,M2-12 | P0 | S |
| M2-15 | infra | 配置 R2 CORS 生产策略 | CORS 规则 | 仅允许生产 Web Origin 上传 | M2-06,M2-11 | P1 | S |
| M2-16 | infra | 创建 `.env.example` | 环境变量模板 | 不含真实 Secret | M2-01:M2-11 | P0 | S |
| M2-17 | infra | 配置 Secret 命名规范 | Secret 文档 | 开发/预发/生产变量名称一致 | M2-16 | P0 | S |
| M2-18 | local | 创建 PostgreSQL Docker Compose 服务 | compose 配置 | 本地数据库可启动 | M0-08 | P0 | S |
| M2-19 | local | 创建 MinIO Docker Compose 服务 | compose 配置 | 本地 S3 上传成功 | M2-18 | P0 | S |
| M2-20 | local | 创建 Mailpit Docker Compose 服务 | compose 配置 | 本地认证邮件可查看 | M2-18 | P1 | S |
| M2-21 | local | 创建一键本地启动脚本 | dev 脚本 | 新目录执行一个命令可启动依赖 | M2-18:M2-20 | P0 | S |
| M2-22 | infra | 创建基础设施状态检查脚本 | doctor 脚本 | 能检测 DB、R2、API、Web 连通性 | M2-01:M2-21 | P1 | M |

**本里程碑任务数：22**

## M3：PostgreSQL 模型与迁移

**里程碑目标：** 建立关系投影、不可变 revision、事件日志和权限基础。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M3-01 | database | 初始化 Drizzle 数据库包 | database package | 迁移命令可运行 | M0-11,M2-18 | P0 | S |
| M3-02 | database | 创建 PostgreSQL 扩展迁移 | extensions migration | uuid/pgcrypto/必要扩展启用 | M3-01 | P0 | S |
| M3-03 | database | 创建通用时间戳与软删除规范 | 数据库规范 | 所有可变投影表规则明确 | M3-01 | P0 | S |
| M3-04 | database | 创建 `actors` 表迁移 | actors migration | 迁移后存在用于Actor 稳定身份的表 | M3-01,M3-02 | P0 | S |
| M3-05 | database | 创建 `actor_profiles` 表迁移 | actor_profiles migration | 迁移后存在用于Actor 展示资料的表 | M3-01,M3-02 | P1 | S |
| M3-06 | database | 创建 `identities` 表迁移 | identities migration | 迁移后存在用于登录身份绑定的表 | M3-01,M3-02 | P1 | S |
| M3-07 | database | 创建 `signing_keys` 表迁移 | signing_keys migration | 迁移后存在用于签名公钥的表 | M3-01,M3-02 | P1 | S |
| M3-08 | database | 创建 `api_tokens` 表迁移 | api_tokens migration | 迁移后存在用于API Token 摘要的表 | M3-01,M3-02 | P1 | S |
| M3-09 | database | 创建 `organizations` 表迁移 | organizations migration | 迁移后存在用于组织的表 | M3-01,M3-02 | P1 | S |
| M3-10 | database | 创建 `organization_members` 表迁移 | organization_members migration | 迁移后存在用于组织成员的表 | M3-01,M3-02 | P1 | S |
| M3-11 | database | 创建 `projects` 表迁移 | projects migration | 迁移后存在用于Project 稳定身份的表 | M3-01,M3-02 | P0 | S |
| M3-12 | database | 创建 `project_revisions` 表迁移 | project_revisions migration | 迁移后存在用于Project revision的表 | M3-01,M3-02 | P1 | S |
| M3-13 | database | 创建 `project_members` 表迁移 | project_members migration | 迁移后存在用于Project 权限的表 | M3-01,M3-02 | P1 | S |
| M3-14 | database | 创建 `questions` 表迁移 | questions migration | 迁移后存在用于Question 稳定身份的表 | M3-01,M3-02 | P0 | S |
| M3-15 | database | 创建 `question_revisions` 表迁移 | question_revisions migration | 迁移后存在用于Question revision的表 | M3-01,M3-02 | P1 | S |
| M3-16 | database | 创建 `research_contracts` 表迁移 | research_contracts migration | 迁移后存在用于ResearchContract 稳定身份的表 | M3-01,M3-02 | P1 | S |
| M3-17 | database | 创建 `research_contract_revisions` 表迁移 | research_contract_revisions migration | 迁移后存在用于ResearchContract revision的表 | M3-01,M3-02 | P1 | S |
| M3-18 | database | 创建 `tasks` 表迁移 | tasks migration | 迁移后存在用于Task 稳定身份的表 | M3-01,M3-02 | P0 | S |
| M3-19 | database | 创建 `task_revisions` 表迁移 | task_revisions migration | 迁移后存在用于Task revision的表 | M3-01,M3-02 | P1 | S |
| M3-20 | database | 创建 `task_dependencies` 表迁移 | task_dependencies migration | 迁移后存在用于Task 依赖的表 | M3-01,M3-02 | P1 | S |
| M3-21 | database | 创建 `task_leases` 表迁移 | task_leases migration | 迁移后存在用于Task 软租约的表 | M3-01,M3-02 | P1 | S |
| M3-22 | database | 创建 `attempts` 表迁移 | attempts migration | 迁移后存在用于Attempt的表 | M3-01,M3-02 | P1 | S |
| M3-23 | database | 创建 `trace_events` 表迁移 | trace_events migration | 迁移后存在用于Attempt Trace的表 | M3-01,M3-02 | P1 | S |
| M3-24 | database | 创建 `claims` 表迁移 | claims migration | 迁移后存在用于Claim 稳定身份的表 | M3-01,M3-02 | P0 | S |
| M3-25 | database | 创建 `claim_revisions` 表迁移 | claim_revisions migration | 迁移后存在用于Claim revision的表 | M3-01,M3-02 | P0 | S |
| M3-26 | database | 创建 `claim_relations` 表迁移 | claim_relations migration | 迁移后存在用于Claim 关系的表 | M3-01,M3-02 | P1 | S |
| M3-27 | database | 创建 `artifacts` 表迁移 | artifacts migration | 迁移后存在用于Artifact 稳定身份的表 | M3-01,M3-02 | P1 | S |
| M3-28 | database | 创建 `artifact_revisions` 表迁移 | artifact_revisions migration | 迁移后存在用于Artifact revision的表 | M3-01,M3-02 | P1 | S |
| M3-29 | database | 创建 `artifact_locations` 表迁移 | artifact_locations migration | 迁移后存在用于Artifact location的表 | M3-01,M3-02 | P1 | S |
| M3-30 | database | 创建 `runs` 表迁移 | runs migration | 迁移后存在用于Run的表 | M3-01,M3-02 | P1 | S |
| M3-31 | database | 创建 `run_inputs` 表迁移 | run_inputs migration | 迁移后存在用于Run 输入的表 | M3-01,M3-02 | P1 | S |
| M3-32 | database | 创建 `run_outputs` 表迁移 | run_outputs migration | 迁移后存在用于Run 输出的表 | M3-01,M3-02 | P1 | S |
| M3-33 | database | 创建 `evidence` 表迁移 | evidence migration | 迁移后存在用于Evidence的表 | M3-01,M3-02 | P1 | S |
| M3-34 | database | 创建 `evidence_claim_links` 表迁移 | evidence_claim_links migration | 迁移后存在用于Evidence 与 Claim 关系的表 | M3-01,M3-02 | P1 | S |
| M3-35 | database | 创建 `verification_contracts` 表迁移 | verification_contracts migration | 迁移后存在用于VerificationContract的表 | M3-01,M3-02 | P1 | S |
| M3-36 | database | 创建 `verification_contract_revisions` 表迁移 | verification_contract_revisions migration | 迁移后存在用于VerificationContract revision的表 | M3-01,M3-02 | P1 | S |
| M3-37 | database | 创建 `verification_policies` 表迁移 | verification_policies migration | 迁移后存在用于VerificationPolicy的表 | M3-01,M3-02 | P1 | S |
| M3-38 | database | 创建 `verification_policy_revisions` 表迁移 | verification_policy_revisions migration | 迁移后存在用于VerificationPolicy revision的表 | M3-01,M3-02 | P1 | S |
| M3-39 | database | 创建 `verification_receipts` 表迁移 | verification_receipts migration | 迁移后存在用于VerificationReceipt的表 | M3-01,M3-02 | P1 | S |
| M3-40 | database | 创建 `verification_findings` 表迁移 | verification_findings migration | 迁移后存在用于Finding的表 | M3-01,M3-02 | P1 | S |
| M3-41 | database | 创建 `challenges` 表迁移 | challenges migration | 迁移后存在用于Challenge 稳定身份的表 | M3-01,M3-02 | P1 | S |
| M3-42 | database | 创建 `challenge_revisions` 表迁移 | challenge_revisions migration | 迁移后存在用于Challenge revision的表 | M3-01,M3-02 | P1 | S |
| M3-43 | database | 创建 `challenge_impacts` 表迁移 | challenge_impacts migration | 迁移后存在用于Challenge 下游影响的表 | M3-01,M3-02 | P1 | S |
| M3-44 | database | 创建 `merge_proposals` 表迁移 | merge_proposals migration | 迁移后存在用于MergeProposal的表 | M3-01,M3-02 | P1 | S |
| M3-45 | database | 创建 `frontier_snapshots` 表迁移 | frontier_snapshots migration | 迁移后存在用于FrontierSnapshot的表 | M3-01,M3-02 | P1 | S |
| M3-46 | database | 创建 `frontier_members` 表迁移 | frontier_members migration | 迁移后存在用于Frontier 成员的表 | M3-01,M3-02 | P1 | S |
| M3-47 | database | 创建 `context_bundles` 表迁移 | context_bundles migration | 迁移后存在用于ContextBundle的表 | M3-01,M3-02 | P1 | S |
| M3-48 | database | 创建 `contribution_statements` 表迁移 | contribution_statements migration | 迁移后存在用于ContributionStatement的表 | M3-01,M3-02 | P1 | S |
| M3-49 | database | 创建 `contribution_edges` 表迁移 | contribution_edges migration | 迁移后存在用于Contribution 边的表 | M3-01,M3-02 | P1 | S |
| M3-50 | database | 创建 `research_events` 表迁移 | research_events migration | 迁移后存在用于ResearchEvent的表 | M3-01,M3-02 | P0 | S |
| M3-51 | database | 创建 `research_event_parents` 表迁移 | research_event_parents migration | 迁移后存在用于Event 父边的表 | M3-01,M3-02 | P1 | S |
| M3-52 | database | 创建 `event_outbox` 表迁移 | event_outbox migration | 迁移后存在用于Transactional Outbox的表 | M3-01,M3-02 | P1 | S |
| M3-53 | database | 创建 `merkle_checkpoints` 表迁移 | merkle_checkpoints migration | 迁移后存在用于Merkle checkpoint的表 | M3-01,M3-02 | P1 | S |
| M3-54 | database | 创建 `notifications` 表迁移 | notifications migration | 迁移后存在用于Notification的表 | M3-01,M3-02 | P1 | S |
| M3-55 | database | 为稳定 ID 添加唯一约束 | unique constraints | 稳定实体 ID 由单列主键保证唯一，ResearchEvent.object_id 保持可重复 | M3-04:M3-54 | P0 | M |
| M3-56 | database | 为 revision 添加复合唯一约束 | revision constraints | 每个 revision 表由 object_id + revision 复合主键保证同对象同版本不可重复 | M3-04:M3-54 | P0 | M |
| M3-57 | database | 为 ClaimRelation 添加重复边约束 | relation constraint | source_claim_id + target_claim_id + relation_type 复合主键阻止重复边 | M3-25 | P0 | S |
| M3-58 | database | 为 depends_on 添加自引用约束 | DAG constraint | task_dependencies_no_self_reference 检查阻止 Task 自依赖 | M3-25 | P0 | S |
| M3-59 | database | 为 ResearchEvent 添加不可更新规则 | event trigger | append-only trigger 拒绝正式事件 UPDATE/DELETE | M3-50 | P0 | M |
| M3-60 | database | 为 revision 表添加不可更新规则 | revision triggers | append-only trigger 拒绝所有 revision 表 UPDATE/DELETE | M3-11,M3-14,M3-17,M3-23,M3-26,M3-35,M3-40 | P0 | M |
| M3-61 | database | 创建 current revision 视图 | SQL views | 四个 current_*_revisions 视图按稳定 ID 返回最大 revision | M3-12,M3-17,M3-23 | P0 | M |
| M3-62 | database | 创建 Claim 上游递归查询 | SQL function | claim_upstream_dependencies 按深度返回全部 depends_on 上游并阻断环 | M3-25 | P0 | M |
| M3-63 | database | 创建 Claim 下游递归查询 | SQL function | claim_downstream_dependents 按深度返回全部依赖下游并阻断环 | M3-25 | P0 | M |
| M3-64 | database | 创建 DAG 环检测函数 | SQL function | assert_claim_dependency_acyclic 触发器拒绝 depends_on 环 | M3-25,M3-61 | P0 | M |
| M3-65 | database | 创建数据库 RLS 默认启用触发器 | RLS trigger | 已为现有 public 表启用 RLS，并由 ddl_command_end 触发器保证新建 public 表自动启用 RLS | M3-02 | P0 | M |
| M3-66 | database | 创建公共只读 RLS 基线 | RLS policies | 匿名角色仅能对明确列出的 public 研究对象执行 SELECT，不具备写权限 | M3-65 | P0 | M |
| M3-67 | database | 创建 Actor 自有数据 RLS | RLS policies | authenticated 角色只能读写其 identity 映射的 profile/key/token | M3-05:M3-07,M3-65 | P0 | M |
| M3-68 | database | 创建 Project 成员 RLS | RLS policies | 非成员不能读 project_members 私有字段 | M3-12,M3-65 | P1 | M |
| M3-69 | database | 创建迁移回滚测试 | migration test | 空库升级和回滚测试通过 | M3-01:M3-68 | P0 | M |
| M3-70 | database | 创建 schema 快照检查 | CI check | 未提交迁移的 schema 变化使 CI 失败 | M3-69 | P1 | S |

**本里程碑任务数：70**

## M4：认证、身份、密钥与权限

**里程碑目标：** 建立 Web、CLI、MCP 共用的身份和签名体系。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M4-01 | auth | 配置 Supabase 邮箱登录 | Auth provider | 测试账号可登录 | M2-01,M3-06 | P0 | S |
| M4-02 | auth | 配置 GitHub OIDC 登录 | Auth provider | GitHub 登录可返回应用 | M4-01 | P1 | S |
| M4-03 | auth | 禁用未配置的 Auth provider | Auth 配置 | 登录页不显示无效 provider | M4-01 | P0 | XS |
| M4-04 | auth | 实现 JWT JWKS 验证 | API middleware | 有效 Supabase JWT 通过 | M4-01,M2-07 | P0 | M |
| M4-05 | auth | 实现失效 JWT 拒绝 | API test | 过期 token 返回 401 | M4-04 | P0 | S |
| M4-06 | auth | 实现 Actor 首次创建 | domain service | 首次登录生成 actor 记录 | M4-04,M3-04 | P0 | M |
| M4-07 | auth | 实现 Identity 绑定 | domain service | 同 provider subject 只能绑定一个 actor | M4-06,M3-06 | P0 | M |
| M4-08 | auth | 实现 Actor Profile 更新 | domain service | 用户只能更新自己的 profile | M4-06,M3-05 | P1 | M |
| M4-09 | signature | 实现 Ed25519 密钥生成库 | signature package | 测试向量可生成 keypair | M1-25 | P0 | M |
| M4-10 | signature | 实现 did:key 编码 | signature package | 公钥可往返编码 | M4-09 | P0 | M |
| M4-11 | signature | 实现 canonical JSON 编码 | canonicalizer | 相同语义对象输出相同字节 | M1-04 | P0 | M |
| M4-12 | signature | 实现客户端 payload 签名 | signature function | 篡改 payload 后验签失败 | M4-09:M4-11 | P0 | M |
| M4-13 | signature | 实现服务端签名验证 | API function | 合法签名通过、错误签名返回固定错误码 | M4-12 | P0 | M |
| M4-14 | signature | 实现签名公钥注册 | API endpoint | Actor 可注册一个 active key | M4-06,M4-13,M3-07 | P0 | M |
| M4-15 | signature | 实现签名公钥撤销 | API endpoint | 撤销后新提交验签失败 | M4-14 | P1 | M |
| M4-16 | signature | 实现密钥轮换声明 | domain service | 旧 key 签署的新 key 关系可验证 | M4-14 | P1 | M |
| M4-17 | token | 实现 API Token 创建 | API endpoint | 返回一次明文 token 且数据库只存摘要 | M4-06,M3-08 | P0 | M |
| M4-18 | token | 实现 API Token scope 校验 | API middleware | 越权 scope 返回 403 | M4-17 | P0 | M |
| M4-19 | token | 实现 API Token 撤销 | API endpoint | 撤销 token 立即失效 | M4-17 | P0 | S |
| M4-20 | token | 实现 API Token 最后使用时间 | token audit | 成功请求后 last_used_at 更新 | M4-17 | P1 | S |
| M4-21 | authz | 定义 Project 角色枚举 | role spec | owner/maintainer/contributor/viewer 可校验 | M3-13 | P0 | XS |
| M4-22 | authz | 实现 Project 角色检查 | domain guard | 无角色的写请求返回 403 | M4-21 | P0 | M |
| M4-23 | authz | 实现对象可见性检查 | domain guard | public/unlisted/member-only 按规则返回 | M4-22 | P0 | M |
| M4-24 | authz | 实现管理员操作 reason 必填 | domain guard | 无 reason 的高权限命令失败 | M4-22 | P1 | S |
| M4-25 | auth | 创建 Web 登录页 | Web page | 邮箱和 GitHub 登录均可发起 | M4-01,M4-02 | P1 | M |
| M4-26 | auth | 创建 Web Session 恢复逻辑 | Web middleware | 刷新页面后登录态保留 | M4-25 | P1 | M |
| M4-27 | auth | 创建 CLI Device/Login 流程 | CLI auth flow | CLI 获得限定 API Token | M4-17 | P1 | M |
| M4-28 | test | 创建权限矩阵集成测试 | auth test suite | 公共、成员、维护者、管理员路径全部覆盖 | M4-22:M4-24 | P0 | M |

**本里程碑任务数：28**

## M5：Domain Core 与 REST API

**里程碑目标：** 完成 Web、CLI、MCP 共用的科研语义读写接口。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M5-01 | api | 初始化 Hono API 应用 | api-edge app | /health 返回 200 | M2-07,M0-10 | P0 | S |
| M5-02 | api | 创建统一错误格式 | error package | 所有错误包含 code/message/request_id | M5-01 | P0 | S |
| M5-03 | api | 创建请求 ID 中间件 | middleware | 响应包含 X-Request-ID | M5-01 | P0 | S |
| M5-04 | api | 创建结构化日志中间件 | middleware | 请求日志不含 token | M5-03 | P0 | S |
| M5-05 | api | 创建 Zod/TypeBox 输入验证适配器 | validation adapter | 非法 body 返回字段路径 | M1-27:M1-38,M5-02 | P0 | M |
| M5-06 | api | 创建游标分页工具 | pagination utility | 稳定排序下翻页无重复 | M5-01 | P0 | M |
| M5-07 | api | 创建 ETag revision 工具 | concurrency utility | If-Match 不匹配返回 412 | M1-03 | P0 | M |
| M5-08 | api | 创建幂等键中间件 | idempotency middleware | 相同 key 相同 payload 返回同一结果 | M5-01,M3-50 | P0 | M |
| M5-09 | api | 实现 Project 创建命令 | domain command | 事务写 Project revision 和 Event | M3-11,M3-50,M4-22 | P0 | M |
| M5-10 | api | 实现 Project 列表查询 | query service | 支持游标分页 | M3-10,M5-06 | P0 | S |
| M5-11 | api | 实现 Project 详情查询 | query service | 返回 current revision | M3-59 | P0 | S |
| M5-12 | api | 实现 Project 修订命令 | domain command | 创建新 revision 不覆盖旧 revision | M5-09,M5-07 | P0 | M |
| M5-13 | api | 实现 Question 创建命令 | domain command | 写 Question revision、Contract 引用和 Event | M3-13:M3-16,M3-50,M4-22 | P0 | M |
| M5-14 | api | 实现 Question 列表查询 | query service | 可按状态和领域过滤 | M3-13,M5-06 | P0 | S |
| M5-15 | api | 实现 Question 详情查询 | query service | 返回 current revision 和 Contract | M3-59 | P0 | S |
| M5-16 | api | 实现 Question 状态迁移命令 | domain command | 非法迁移返回 STATE_TRANSITION_INVALID | M1-08,M5-13 | P0 | M |
| M5-17 | api | 实现 ResearchContract 修订命令 | domain command | 新 revision 保留旧版本 | M3-15,M3-16,M5-07 | P0 | M |
| M5-18 | api | 实现 Task 创建命令 | domain command | 写 Task revision 和 Event | M3-17,M3-18,M3-50 | P0 | M |
| M5-19 | api | 实现 Task 列表查询 | query service | 支持 project/status/type/tag 过滤 | M3-17,M5-06 | P0 | M |
| M5-20 | api | 实现 Task 详情查询 | query service | 返回依赖和当前租约 | M3-18:M3-20 | P0 | S |
| M5-21 | api | 实现 Task 修订命令 | domain command | 使用 ETag 防并发覆盖 | M5-18,M5-07 | P0 | M |
| M5-22 | api | 实现 Task 状态迁移命令 | domain command | 状态机测试通过 | M1-09,M5-18 | P0 | M |
| M5-23 | api | 实现 TaskDependency 创建命令 | domain command | 重复依赖被拒绝 | M3-19,M5-18 | P1 | S |
| M5-24 | api | 实现 TaskLease 获取命令 | domain command | 租约不阻止第二个 Attempt | M3-20,M5-18 | P1 | M |
| M5-25 | api | 实现 TaskLease 续期命令 | domain command | 只有持有者可续期 | M5-24 | P1 | S |
| M5-26 | api | 实现 TaskLease 过期命令 | domain command | 过期租约状态更新 | M5-24 | P1 | S |
| M5-27 | api | 实现 Attempt 创建命令 | domain command | Attempt 关联 Task、Actor、Context | M3-21,M5-18 | P0 | M |
| M5-28 | api | 实现 Attempt 详情查询 | query service | 返回 trace 摘要 | M3-21,M3-22 | P1 | S |
| M5-29 | api | 实现 Attempt 状态迁移命令 | domain command | submitted 后禁止追加普通 trace | M1-10,M5-27 | P1 | M |
| M5-30 | api | 实现 TraceEvent 创建命令 | domain command | 只允许可公开摘要字段 | M3-22,M5-27 | P1 | M |
| M5-31 | api | 实现 Claim 创建命令 | domain command | 写稳定 Claim、revision、Event | M3-23,M3-24,M3-50,M4-13 | P0 | M |
| M5-32 | api | 实现 Claim 修订命令 | domain command | 新 revision 的 revision_number 连续 | M5-31,M3-57 | P0 | M |
| M5-33 | api | 实现 Claim 列表查询 | query service | 支持 status/project/tag 过滤 | M3-23,M5-06 | P0 | M |
| M5-34 | api | 实现 Claim 详情查询 | query service | 返回 current revision 与状态 Policy | M3-59 | P0 | S |
| M5-35 | api | 实现 Claim revision 查询 | query service | 指定 revision 返回不可变内容 | M3-24 | P0 | S |
| M5-36 | api | 实现 ClaimRelation 创建命令 | domain command | depends_on 环被拒绝 | M3-25,M3-63 | P0 | M |
| M5-37 | api | 实现 ClaimRelation 删除替代命令 | domain command | 不删除旧边而创建结束事件 | M5-36,M3-50 | P1 | M |
| M5-38 | api | 实现 Claim 上游图查询 | query service | 返回有界深度图 | M3-61 | P0 | M |
| M5-39 | api | 实现 Claim 下游图查询 | query service | 返回 dependency_tainted 标记 | M3-62 | P0 | M |
| M5-40 | api | 实现 Claim 状态迁移命令 | domain command | 迁移写 status transition 和 Event | M1-11,M3-50,M5-31 | P0 | M |
| M5-41 | api | 实现 Challenge 创建命令 | domain command | 锁定目标对象 revision | M3-41,M3-42,M3-50 | P0 | M |
| M5-42 | api | 实现 Challenge 详情查询 | query service | 返回 impact 与 linked evidence | M3-42,M3-43 | P1 | S |
| M5-43 | api | 实现 Challenge 状态迁移命令 | domain command | upheld 时写影响事件 | M1-12,M5-41 | P0 | M |
| M5-44 | api | 实现 Contribution 查询 | query service | 按 Actor 返回角色与 produced/used | M3-47,M3-48 | P1 | M |
| M5-45 | api | 生成 OpenAPI 文档 | openapi.json | 所有公开端点出现在文档 | M5-09:M5-44 | P0 | M |
| M5-46 | api | 创建 API Contract 快照测试 | contract test | 破坏性变化使 CI 失败 | M5-45 | P1 | S |

**本里程碑任务数：46**

## M6：Artifact、Evidence、Run 与对象存储

**里程碑目标：** 实现可验证、不可覆盖、低成本的大文件与运行记录链路。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M6-01 | storage | 实现 SHA-256 流式计算库 | hash utility | 1GB 测试文件可流式计算且内存受控 | M1-04 | P0 | M |
| M6-02 | storage | 实现 canonical semantic hash | hash utility | 字段顺序不同的等价 JSON hash 相同 | M4-11 | P0 | M |
| M6-03 | storage | 实现 hash 命名对象键生成 | key utility | 同 hash 生成同 key | M6-01 | P0 | S |
| M6-04 | storage | 实现 R2 预签单文件上传 | API endpoint | 客户端可直传小文件 | M2-04,M5-01 | P0 | M |
| M6-05 | storage | 实现 R2 multipart 初始化 | API endpoint | 返回 upload_id 与分片参数 | M2-04,M5-01 | P1 | M |
| M6-06 | storage | 实现 R2 multipart 完成 | API endpoint | 所有分片完成后对象可读取 | M6-05 | P1 | M |
| M6-07 | storage | 实现上传 Session 过期 | cleanup rule | 过期 Session 不能完成 | M6-04 | P1 | S |
| M6-08 | storage | 实现上传大小验证 | validation | 声明 size 与对象 size 不一致时失败 | M6-04 | P0 | M |
| M6-09 | storage | 实现上传 hash 验证 Worker | worker job | 对象 hash 不一致时标记 invalid | M6-01,M6-04 | P0 | M |
| M6-10 | storage | 实现重复内容去重 | domain service | 相同 raw_hash 复用存储对象 | M6-03,M6-09 | P1 | M |
| M6-11 | artifact | 实现 Artifact 创建命令 | domain command | 写 Artifact、revision、location、Event | M3-26:M3-28,M6-09 | P0 | M |
| M6-12 | artifact | 实现 Artifact location 追加命令 | domain command | 新增镜像不改变旧 revision 内容 | M6-11 | P1 | M |
| M6-13 | artifact | 实现 Artifact 详情查询 | query service | 返回 hash、size、license、locations | M6-11 | P0 | S |
| M6-14 | artifact | 实现 Artifact 下载重定向 | API endpoint | 仅返回允许 visibility 的 location | M6-13,M4-23 | P1 | S |
| M6-15 | artifact | 实现 Artifact license 校验 | validation | public Artifact 无 license 时失败 | M6-11 | P0 | S |
| M6-16 | artifact | 实现 Artifact media type 检测 | worker job | 实际类型与声明冲突时产生 Finding | M6-09 | P1 | M |
| M6-17 | artifact | 实现 Artifact 恶意文件扫描接口 | worker adapter | 扫描结果能写入 Artifact 状态 | M6-09 | P1 | M |
| M6-18 | run | 实现 Run 创建命令 | domain command | 写 Run、输入、输出和 Event | M3-29:M3-31,M6-11 | P0 | M |
| M6-19 | run | 实现 Run 输入关联校验 | domain validation | 不存在的 ArtifactRevision 被拒绝 | M6-18 | P0 | S |
| M6-20 | run | 实现 Run 输出关联校验 | domain validation | 输出 hash 未验证时 Run 不能 final | M6-18,M6-09 | P0 | S |
| M6-21 | run | 实现 OCI digest 格式校验 | validation | 可变 tag 单独使用时失败 | M1-18 | P0 | S |
| M6-22 | run | 实现随机种子标准化 | normalizer | 相同种子集合生成稳定 semantic hash | M6-18 | P1 | S |
| M6-23 | run | 实现 Run 详情查询 | query service | 返回环境、命令、输入和输出 | M6-18 | P0 | S |
| M6-24 | evidence | 实现 Evidence 创建命令 | domain command | 写 Evidence 和 Event | M3-32,M6-11,M6-18 | P0 | M |
| M6-25 | evidence | 实现 Evidence-Claim link 命令 | domain command | 锁定具体 ClaimRevision | M3-33,M6-24 | P0 | M |
| M6-26 | evidence | 实现 Evidence 详情查询 | query service | 返回 Run、Artifact 和 Claim links | M6-24,M6-25 | P0 | S |
| M6-27 | evidence | 实现外部 Artifact location 提交 | domain command | URL/hash/size/license 均必填 | M6-11 | P1 | M |
| M6-28 | evidence | 实现分块 Manifest Schema | schema | 所有 chunk hash 和 offset 可校验 | M6-01 | P1 | M |
| M6-29 | evidence | 实现分块 Manifest 验证 | worker job | 任一 chunk hash 错误时失败 | M6-28 | P1 | M |
| M6-30 | test | 创建 Evidence 篡改单元测试 | test suite | 修改一字节导致验证失败 | M6-09,M6-29 | P0 | S |

**本里程碑任务数：30**

## M7：ResearchEvent、完整性与透明日志

**里程碑目标：** 让正式状态、签名、贡献和公共时间线可独立审计。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M7-01 | event | 实现 Event append service | domain service | 写入事件后不可更新 | M3-50,M3-58 | P0 | M |
| M7-02 | event | 实现对象事件哈希链 | event service | 同对象事件包含 previous hash | M7-01 | P0 | M |
| M7-03 | event | 实现 Actor 事件哈希链 | event service | 同 Actor 事件包含 previous hash | M7-01 | P0 | M |
| M7-04 | event | 实现 Platform Receipt 签名 | receipt service | Receipt 可用平台公钥验证 | M1-26,M4-09 | P0 | M |
| M7-05 | event | 实现客户端签名保留 | event service | 原始 client signature 可查询 | M4-13,M7-01 | P0 | S |
| M7-06 | event | 实现 Event 查询端点 | API endpoint | 按 object/actor/type/时间过滤 | M7-01,M5-06 | P1 | M |
| M7-07 | event | 实现 Event 导出 NDJSON | export function | 连续区间可导出 | M7-06 | P1 | M |
| M7-08 | outbox | 实现事务 Outbox 写入 | domain service | 正式命令与 outbox 同事务提交 | M3-51,M7-01 | P0 | M |
| M7-09 | outbox | 实现 Outbox claim 锁 | worker utility | 并发 Worker 不重复处理同一 job | M7-08 | P0 | M |
| M7-10 | outbox | 实现 Outbox 成功确认 | worker utility | 完成 job 标记 processed_at | M7-09 | P0 | S |
| M7-11 | outbox | 实现 Outbox 失败重试 | worker utility | 指数退避且记录 last_error | M7-09 | P0 | M |
| M7-12 | outbox | 实现 Outbox dead-letter 状态 | worker utility | 超过次数后不再自动重试 | M7-11 | P1 | S |
| M7-13 | merkle | 实现 Merkle leaf 编码 | merkle package | 相同 Event 生成相同 leaf | M7-01 | P1 | M |
| M7-14 | merkle | 实现 Merkle tree 构建 | merkle package | 测试向量 root 正确 | M7-13 | P1 | M |
| M7-15 | merkle | 实现 inclusion proof 生成 | merkle package | 任意叶子 proof 可验证 | M7-14 | P1 | M |
| M7-16 | merkle | 实现 inclusion proof 验证 | merkle package | 篡改 proof 验证失败 | M7-15 | P1 | M |
| M7-17 | merkle | 实现 checkpoint 创建 Worker | worker job | 连续事件区间生成 checkpoint | M3-52,M7-14 | P1 | M |
| M7-18 | merkle | 实现 checkpoint 签名 | checkpoint service | 平台公钥可验证 root 签名 | M7-17,M7-04 | P1 | S |
| M7-19 | merkle | 实现 checkpoint 查询端点 | API endpoint | 返回 root、范围和签名 | M7-17,M7-18 | P1 | S |
| M7-20 | merkle | 实现 Event inclusion proof 端点 | API endpoint | 给定 Event 返回可验证 proof | M7-15,M7-19 | P1 | M |
| M7-21 | provenance | 实现 ContributionStatement 创建 | domain service | 正式科研事件产生至少一个角色贡献 | M3-47,M7-01 | P0 | M |
| M7-22 | provenance | 实现 Contribution produced 边 | domain service | 贡献可指向产出对象 revision | M3-48,M7-21 | P0 | S |
| M7-23 | provenance | 实现 Contribution used 边 | domain service | 贡献可指向使用对象 revision | M3-48,M7-21 | P0 | S |
| M7-24 | provenance | 实现 W3C PROV 导出映射 | export adapter | 示例贡献图可导出 Entity/Activity/Agent | M7-21:M7-23 | P2 | M |
| M7-25 | provenance | 实现对象完整 provenance 查询 | query service | 返回 Actor→Event→Object→Frontier 路径 | M7-21:M7-23,M3-46 | P1 | M |
| M7-26 | test | 创建 Event 重放重建测试 | integration test | 清空协议投影后可重建核心状态 | M7-01,M3-59 | P1 | M |
| M7-27 | test | 创建 Event 删除阻断测试 | integration test | 普通应用角色 DELETE event 失败 | M3-58 | P0 | S |
| M7-28 | test | 创建 revision 修改阻断测试 | integration test | 普通应用角色 UPDATE revision 失败 | M3-59 | P0 | S |
| M7-29 | keys | 创建平台签名密钥轮换流程 | runbook + code | 新旧 key 均可验证历史 Receipt | M7-04 | P1 | M |
| M7-30 | keys | 发布平台公钥端点 | API endpoint | 客户端可获取带 key_id 的公钥集 | M7-29 | P1 | S |

**本里程碑任务数：30**

## M8：Context、验证策略、挑战与 Frontier

**里程碑目标：** 完成推进式科研的核心循环。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M8-01 | context | 实现 Frontier Context 编译器 | worker job | Bundle 仅含固定 Frontier 与必要依赖 | M3-46,M5-38 | P0 | M |
| M8-02 | context | 实现 Full Trace Context 编译器 | worker job | Bundle 包含公开 Attempt Trace | M3-22,M8-01 | P1 | M |
| M8-03 | context | 实现 Adversarial Context 编译器 | worker job | Bundle 隐藏主流解释性摘要 | M8-01 | P0 | M |
| M8-04 | context | 实现 Blind Context 编译器 | worker job | Bundle 不含预期输出与指定路径 | M8-01 | P0 | M |
| M8-05 | context | 实现 ContextBundle hash | integrity function | Bundle 下载后可验证 hash | M6-02,M8-01:M8-04 | P0 | S |
| M8-06 | context | 实现 ContextBundle 创建命令 | domain service | 创建后写 Event | M3-45,M8-05,M7-01 | P0 | M |
| M8-07 | context | 实现 Task Context 查询端点 | API endpoint | mode 参数返回对应 Bundle | M8-06 | P0 | M |
| M8-08 | context | 实现 Context 访问审计 | event hook | 下载受限 Bundle 产生审计事件 | M8-07,M7-01 | P1 | S |
| M8-09 | verification | 实现 VerificationContract 创建 | domain command | 写稳定对象、revision、Event | M3-34,M3-35,M7-01 | P0 | M |
| M8-10 | verification | 实现 VerificationPolicy 创建 | domain command | 写稳定对象、revision、Event | M3-36,M3-37,M7-01 | P0 | M |
| M8-11 | verification | 实现 Verification prepare | API endpoint | 返回锁定 ClaimRevision 的待签名对象 | M8-09,M5-35 | P0 | M |
| M8-12 | verification | 实现 Verification submit | domain command | 写 Receipt、Finding、Contribution、Event | M3-38,M3-39,M7-21,M8-11 | P0 | M |
| M8-13 | verification | 实现 Verification 详情查询 | query service | 返回独立性字段和证据强度 | M8-12 | P0 | S |
| M8-14 | verification | 实现 Claim Verification 列表 | query service | 按 outcome/context/actor 过滤 | M8-12 | P0 | M |
| M8-15 | verification | 实现重复验证检测 | domain validation | 同 Actor 同 Run 重复 Receipt 被标记 | M8-12 | P1 | S |
| M8-16 | policy | 实现 Policy JSON 解释器 | policy engine | 示例 requirements 可计算 | M1-21,M8-10 | P0 | M |
| M8-17 | policy | 实现 blocking Finding 规则 | policy rule | 存在 blocking Finding 时不升级 | M8-16,M3-39 | P0 | S |
| M8-18 | policy | 实现 refuting Receipt 规则 | policy rule | 存在有效 refute 时状态变 contested | M8-16,M8-12 | P0 | S |
| M8-19 | policy | 实现 blind 数量规则 | policy rule | 不足 blind receipt 时不升级 | M8-16,M8-12 | P0 | S |
| M8-20 | policy | 实现 distinct implementation 规则 | policy rule | 实现数不足时不升级 | M8-16,M8-12 | P0 | S |
| M8-21 | policy | 实现 challenge window 规则 | policy rule | 窗口未结束时不 accepted | M8-16 | P0 | S |
| M8-22 | policy | 实现 Policy evaluation Worker | worker job | Claim 变化后自动计算结果 | M8-16:M8-21,M7-08 | P0 | M |
| M8-23 | policy | 实现 Policy 评估结果记录 | domain service | 每次评估保存 policy revision 和输入摘要 | M8-22 | P0 | M |
| M8-24 | challenge | 实现 Challenge impact 计算 | worker job | upheld challenge 返回全部下游 Claim | M5-43,M3-62 | P0 | M |
| M8-25 | challenge | 实现 dependency_tainted 标记 | domain service | 下游状态被标记且写 Event | M8-24,M5-40 | P0 | M |
| M8-26 | challenge | 实现重新验证 Task 生成 | worker job | 每个受影响 Claim 生成去重 Task | M8-25,M5-18 | P1 | M |
| M8-27 | frontier | 实现 MergeProposal 创建 | domain command | 固定候选 ClaimRevision 和 Policy | M3-44,M8-23 | P0 | M |
| M8-28 | frontier | 实现 MergeProposal 查询 | query service | 返回满足与未满足条件 | M8-27 | P1 | S |
| M8-29 | frontier | 实现 FrontierSnapshot 创建 | domain command | sequence 连续且 previous 固定 | M3-45,M8-27 | P0 | M |
| M8-30 | frontier | 实现 FrontierMember 写入 | domain service | 成员只能引用固定 revision | M3-46,M8-29 | P0 | S |
| M8-31 | frontier | 实现 Frontier 最新查询 | query service | 返回项目最大 sequence | M8-29 | P0 | S |
| M8-32 | frontier | 实现 Frontier 历史查询 | query service | 支持游标分页 | M8-29 | P1 | S |
| M8-33 | frontier | 实现 Frontier diff | query service | 返回 added/removed/status-changed | M8-29,M8-30 | P1 | M |
| M8-34 | frontier | 实现 Frontier 发布事件 | domain service | 发布后产生 frontier.published | M8-29,M7-01 | P0 | S |
| M8-35 | frontier | 实现新 Frontier 后续 Task 建议接口 | worker job | 至少生成 open blocker 类型建议 | M8-34,M3-17 | P2 | M |
| M8-36 | test | 创建 Policy 固定测试向量 | test suite | 相同输入在相同 revision 下结果稳定 | M8-16:M8-23 | P0 | M |
| M8-37 | test | 创建依赖污染集成测试 | integration test | 上游 contested 后下游全部 tainted | M8-24:M8-26 | P0 | M |
| M8-38 | test | 创建 Frontier 不可变测试 | integration test | 已发布 Frontier UPDATE/DELETE 失败 | M8-29 | P0 | S |

**本里程碑任务数：38**

## M9：Web 产品

**里程碑目标：** 让人类在不接触 GitHub、CLI 或数据库的情况下完成完整科研流程。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M9-01 | web | 初始化 Next.js Web 应用 | apps/web | 首页可本地访问 | M0-10 | P0 | S |
| M9-02 | web | 配置 Tailwind | 样式系统 | 示例组件样式生效 | M9-01 | P0 | S |
| M9-03 | web | 配置 shadcn/ui 基础组件 | UI package | Button/Input/Dialog 可使用 | M9-02 | P1 | S |
| M9-04 | web | 建立设计 Token | theme config | 浅色/深色变量完整 | M9-02 | P1 | M |
| M9-05 | web | 建立主导航 | layout | 首页/项目/任务/验证/贡献可导航 | M9-01 | P0 | M |
| M9-06 | web | 实现全局错误页 | error boundary | API 失败显示 request_id | M5-03,M9-01 | P0 | S |
| M9-07 | web | 实现全局加载骨架 | loading UI | 主要路由均有 skeleton | M9-01 | P1 | S |
| M9-08 | web | 实现登录页 | auth page | 邮箱/GitHub 登录可用 | M4-25 | P0 | M |
| M9-09 | web | 实现账号设置页 | settings page | 可编辑 profile | M4-08,M9-08 | P1 | M |
| M9-10 | web | 实现签名密钥注册 UI | key page | 可生成并注册公钥 | M4-14,M9-09 | P1 | M |
| M9-11 | web | 实现 API Token 管理 UI | token page | 可创建和撤销 token | M4-17:M4-19,M9-09 | P1 | M |
| M9-12 | web | 实现首页开放问题列表 | home section | 按最新活动展示 | M5-14,M9-05 | P0 | M |
| M9-13 | web | 实现首页待验证 Claim 列表 | home section | 只显示 under_verification/provisional | M5-33,M9-05 | P0 | M |
| M9-14 | web | 实现首页最新 Frontier 列表 | home section | 显示项目和 sequence | M8-31,M9-05 | P1 | S |
| M9-15 | web | 实现首页新手任务列表 | home section | 支持 cpu-only/under-60-min 标签 | M5-19,M9-05 | P1 | M |
| M9-16 | web | 实现 Project 列表页 | page | 支持分页和领域筛选 | M5-10 | P0 | M |
| M9-17 | web | 实现 Project 详情页 | page | 显示 Question、Frontier、Task 摘要 | M5-11,M8-31 | P0 | M |
| M9-18 | web | 实现 Project 创建表单 | form | 提交后创建 Project | M5-09,M9-08 | P1 | M |
| M9-19 | web | 实现 Question 提交向导第一步 | form step | 可填写问题与价值 | M5-13 | P0 | M |
| M9-20 | web | 实现 Question 提交向导第二步 | form step | 可填写范围与排除项 | M9-19 | P0 | S |
| M9-21 | web | 实现 Question 提交向导第三步 | form step | 可填写进展与证伪条件 | M9-20 | P0 | S |
| M9-22 | web | 实现 Question 提交向导第四步 | form step | 可填写许可与风险 | M9-21 | P0 | S |
| M9-23 | web | 实现 Question 提交预览 | preview | 显示规范化对象 | M9-19:M9-22 | P0 | S |
| M9-24 | web | 实现 Question 正式提交 | submit action | 成功后跳转 Question 页面 | M9-23,M5-13 | P0 | M |
| M9-25 | web | 实现 Question 详情页 | page | 显示 Contract、状态和 Task | M5-15,M9-17 | P0 | M |
| M9-26 | web | 实现 Task 看板 | board | 按状态泳道显示 | M5-19,M9-17 | P0 | M |
| M9-27 | web | 实现 Task 筛选器 | filter UI | 支持类型、状态、标签、context mode | M9-26 | P1 | M |
| M9-28 | web | 实现 Task 详情页 | page | 显示输入、输出、验收、依赖和租约 | M5-20 | P0 | M |
| M9-29 | web | 实现开始 Attempt 操作 | action | 创建 Attempt 并显示 Context 下载 | M5-27,M8-07 | P0 | M |
| M9-30 | web | 实现 TaskLease 操作 | action | 可获取和释放软租约 | M5-24:M5-26,M9-28 | P2 | S |
| M9-31 | web | 实现 Claim 列表页 | page | 支持 status/tag 过滤 | M5-33 | P0 | M |
| M9-32 | web | 实现 Claim 详情页 | page | 显示 statement/scope/falsification/revisions | M5-34:M5-35 | P0 | M |
| M9-33 | web | 集成 Cytoscape.js | DAG component | 示例图可渲染 | M9-01 | P0 | M |
| M9-34 | web | 实现 Claim 上下游 DAG | DAG view | 可切换 upstream/downstream | M5-38,M5-39,M9-33 | P0 | M |
| M9-35 | web | 实现 DAG 状态图例 | legend | 颜色仅表示状态 | M9-34 | P1 | S |
| M9-36 | web | 实现 DAG 节点详情抽屉 | drawer | 点击节点显示 revision 与 Evidence | M9-34 | P1 | M |
| M9-37 | web | 实现 Frontier 时间旅行 | DAG control | 选择 Frontier 后图按固定成员重绘 | M8-32,M9-34 | P1 | M |
| M9-38 | web | 实现 Claim 创建编辑器 | editor | 支持 statement/scope/assumptions/falsification | M5-31,M9-29 | P0 | M |
| M9-39 | web | 实现 Claim revision diff | diff view | 两个 revision 字段差异可见 | M5-35,M9-32 | P1 | M |
| M9-40 | web | 实现 Evidence 上传面板 | upload UI | 直传 R2 并显示 hash 进度 | M6-04,M6-09 | P0 | M |
| M9-41 | web | 实现 Artifact 详情页 | page | 显示 hash、license、locations | M6-13 | P1 | M |
| M9-42 | web | 实现 Run Receipt 表单 | form | 可填写环境、命令、种子和输出 | M6-18 | P0 | M |
| M9-43 | web | 实现 Evidence 创建表单 | form | 可关联 Run、Artifact、ClaimRevision | M6-24:M6-25 | P0 | M |
| M9-44 | web | 实现 Verification 工作区 | workspace | 显示 Blind Context 且隐藏预期输出 | M8-04,M8-11 | P0 | M |
| M9-45 | web | 实现 Verification Receipt 表单 | form | 支持 outcome/independence/findings | M8-12 | P0 | M |
| M9-46 | web | 实现 Challenge 表单 | form | 可锁定目标 revision 与反例 Evidence | M5-41 | P0 | M |
| M9-47 | web | 实现 Finding 字段定位 | form integration | 服务端 Finding 可定位到输入字段 | M5-05,M9-38:M9-46 | P1 | M |
| M9-48 | web | 实现 Frontier 详情页 | page | 显示 members/policy/checkpoint/diff | M8-29:M8-33 | P0 | M |
| M9-49 | web | 实现贡献者详情页 | page | 显示角色、produced、used、Frontier 使用 | M5-44,M7-25 | P1 | M |
| M9-50 | web | 实现 Event 审计页 | page | 显示签名和哈希链 | M7-06,M7-30 | P2 | M |
| M9-51 | web | 实现 SSE 客户端 | realtime client | 项目事件可实时更新 | M5-01 | P1 | M |
| M9-52 | web | 实现浏览器草稿存储 | IndexedDB storage | 刷新后草稿保留 | M9-19:M9-46 | P1 | M |
| M9-53 | web | 实现草稿 Bundle 导出 | download action | 草稿可导出 JSON/ZIP | M9-52 | P2 | M |
| M9-54 | web | 实现草稿 Bundle 导入 | upload action | 导入后恢复表单字段 | M9-53 | P2 | M |
| M9-55 | web | 实现响应式布局测试 | UI test | 375px 和 1440px 无横向溢出 | M9-05:M9-50 | P1 | M |
| M9-56 | web | 实现基础可访问性测试 | a11y test | 关键页面无严重 axe 错误 | M9-05:M9-50 | P1 | M |

**本里程碑任务数：56**

## M10：TypeScript SDK 与 CLI

**里程碑目标：** 让任意 Agent Harness 或开发者无需使用 Web 即可参与。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M10-01 | sdk | 初始化 `@evimesh/sdk` | SDK package | 可导入 API client | M0-11,M5-45 | P0 | S |
| M10-02 | sdk | 根据 OpenAPI 生成 TypeScript 类型 | generated types | 生成物可编译 | M5-45,M10-01 | P0 | M |
| M10-03 | sdk | 实现认证请求客户端 | SDK auth | 支持 JWT 和 API Token | M10-01,M4-17 | P0 | M |
| M10-04 | sdk | 实现幂等键自动生成 | SDK middleware | 写请求默认携带 key | M5-08,M10-01 | P0 | S |
| M10-05 | sdk | 实现分页迭代器 | SDK utility | 可遍历多页 Project | M5-06,M10-01 | P1 | M |
| M10-06 | sdk | 实现错误类型映射 | SDK errors | 服务端 code 映射为类型化异常 | M5-02,M10-01 | P0 | S |
| M10-07 | sdk | 实现 Project client | SDK module | create/list/get/revise 可调用 | M5-09:M5-12 | P1 | M |
| M10-08 | sdk | 实现 Question client | SDK module | create/list/get/transition 可调用 | M5-13:M5-17 | P0 | M |
| M10-09 | sdk | 实现 Task client | SDK module | list/get/lease/create 可调用 | M5-18:M5-26 | P0 | M |
| M10-10 | sdk | 实现 Attempt client | SDK module | start/trace/submit 可调用 | M5-27:M5-30 | P0 | M |
| M10-11 | sdk | 实现 Claim client | SDK module | create/revise/get/graph 可调用 | M5-31:M5-40 | P0 | M |
| M10-12 | sdk | 实现 Artifact client | SDK module | upload/create/get 可调用 | M6-04:M6-14 | P0 | M |
| M10-13 | sdk | 实现 Run client | SDK module | submit/get 可调用 | M6-18:M6-23 | P0 | M |
| M10-14 | sdk | 实现 Evidence client | SDK module | create/link/get 可调用 | M6-24:M6-27 | P0 | M |
| M10-15 | sdk | 实现 Verification client | SDK module | prepare/submit/list 可调用 | M8-11:M8-14 | P0 | M |
| M10-16 | sdk | 实现 Challenge client | SDK module | create/get/transition 可调用 | M5-41:M5-43 | P0 | M |
| M10-17 | sdk | 实现 Frontier client | SDK module | latest/history/diff 可调用 | M8-31:M8-33 | P0 | M |
| M10-18 | sdk | 实现 Event proof client | SDK module | 可获取并验证 inclusion proof | M7-20 | P1 | M |
| M10-19 | cli | 初始化 `@evimesh/cli` | CLI package | `sq --help` 可执行 | M10-01 | P0 | S |
| M10-20 | cli | 实现 `sq config init` | CLI command | 生成配置文件 | M10-19 | P0 | S |
| M10-21 | cli | 实现 `sq auth login` | CLI command | 可保存限定 token | M4-27,M10-03 | P0 | M |
| M10-22 | cli | 实现 `sq identity generate` | CLI command | 生成 Ed25519 keypair | M4-09,M10-19 | P0 | M |
| M10-23 | cli | 实现 `sq project list` | CLI command | 支持 `--json` | M10-07,M10-19 | P1 | S |
| M10-24 | cli | 实现 `sq question list` | CLI command | 支持领域过滤 | M10-08,M10-19 | P0 | S |
| M10-25 | cli | 实现 `sq task list` | CLI command | 支持状态和标签过滤 | M10-09,M10-19 | P0 | M |
| M10-26 | cli | 实现 `sq task inspect` | CLI command | 输出 Task 与依赖 | M10-09,M10-19 | P0 | S |
| M10-27 | cli | 实现 `sq context pull` | CLI command | 下载并验证 ContextBundle hash | M8-07,M8-05,M10-19 | P0 | M |
| M10-28 | cli | 实现 `sq attempt start` | CLI command | 创建本地 workspace 与远端 Attempt | M10-10,M10-19 | P0 | M |
| M10-29 | cli | 实现 `sq claim create` | CLI command | 生成 Claim 模板 | M1-31,M10-19 | P0 | M |
| M10-30 | cli | 实现 `sq evidence add` | CLI command | 计算 hash 并直传对象存储 | M10-12,M10-19 | P0 | M |
| M10-31 | cli | 实现 `sq run record` | CLI command | 生成 Run Receipt | M10-13,M10-19 | P0 | M |
| M10-32 | cli | 实现 `sq validate` | CLI command | 本地运行协议 Schema | M1-39,M10-19 | P0 | M |
| M10-33 | cli | 实现 `sq submit` | CLI command | 签名并提交 Claim/Evidence/Run Bundle | M10-11:M10-14,M10-22,M10-32 | P0 | M |
| M10-34 | cli | 实现 `sq verify checkout` | CLI command | 锁定 ClaimRevision 并拉取 Blind Context | M10-15,M10-27 | P0 | M |
| M10-35 | cli | 实现 `sq verify submit` | CLI command | 签名并提交 VerificationReceipt | M10-15,M10-22 | P0 | M |
| M10-36 | cli | 实现 `sq challenge create` | CLI command | 提交 Challenge 与 Evidence 引用 | M10-16,M10-22 | P1 | M |
| M10-37 | cli | 实现 `sq provenance` | CLI command | 输出贡献和依赖路径 | M10-11,M10-18 | P1 | M |
| M10-38 | cli | 实现 `sq bundle verify` | CLI command | 离线验证 hash、签名和 proof | M10-18 | P1 | M |
| M10-39 | cli | 为全部写命令实现 `--dry-run` | CLI behavior | 不发送请求即可输出规范化 payload | M10-28:M10-36 | P0 | M |
| M10-40 | cli | 为全部命令实现 `--json` | CLI behavior | 输出可被 Agent 稳定解析 | M10-23:M10-37 | P0 | M |
| M10-41 | release | 发布 SDK alpha | npm release | npm 可安装 alpha 版本 | M10-01:M10-18 | P1 | S |
| M10-42 | release | 发布 CLI alpha | npm release | npm 可安装 alpha 版本 | M10-19:M10-39 | P1 | S |

**本里程碑任务数：42**

## M11：MCP Server

**里程碑目标：** 以科研语义向任意支持 MCP 的 Agent 暴露上下文与工具。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M11-01 | mcp | 初始化 MCP Server 包 | apps/mcp | stdio server 可启动 | M0-10,M10-01 | P0 | S |
| M11-02 | mcp | 实现 API Token 配置读取 | MCP auth | Server 可调用 EviMesh API | M11-01,M4-17 | P0 | S |
| M11-03 | mcp | 实现 Projects Resource | MCP resource | 返回项目列表 | M10-07,M11-01 | P1 | S |
| M11-04 | mcp | 实现 Open Questions Resource | MCP resource | 返回开放问题 | M10-08,M11-01 | P0 | S |
| M11-05 | mcp | 实现 Open Tasks Resource | MCP resource | 返回开放任务 | M10-09,M11-01 | P0 | S |
| M11-06 | mcp | 实现 Task Context Resource | MCP resource | 支持四种 mode | M10-27,M11-01 | P0 | M |
| M11-07 | mcp | 实现 Claim Revision Resource | MCP resource | 固定 revision 可读取 | M10-11,M11-01 | P0 | S |
| M11-08 | mcp | 实现 Frontier Resource | MCP resource | latest 和 sequence 可读取 | M10-17,M11-01 | P0 | S |
| M11-09 | mcp | 实现 Contribution Resource | MCP resource | Actor 贡献可读取 | M10-36,M11-01 | P1 | S |
| M11-10 | mcp | 实现 `search_open_tasks` Tool | MCP tool | 支持 filter 参数 | M10-09,M11-01 | P0 | M |
| M11-11 | mcp | 实现 `get_task_context` Tool | MCP tool | 返回 Bundle 和 hash | M10-27,M11-01 | P0 | M |
| M11-12 | mcp | 实现 `start_attempt` Tool | MCP tool | 创建 Attempt 前返回确认摘要 | M10-28,M11-01 | P0 | M |
| M11-13 | mcp | 实现 `record_trace` Tool | MCP tool | 写入公开 Trace 摘要 | M10-10,M11-01 | P1 | M |
| M11-14 | mcp | 实现 `create_claim` Tool | MCP tool | 只创建本地草稿对象 | M10-29,M11-01 | P0 | M |
| M11-15 | mcp | 实现 `attach_evidence` Tool | MCP tool | 返回 hash 与上传结果 | M10-30,M11-01 | P0 | M |
| M11-16 | mcp | 实现 `record_run` Tool | MCP tool | 创建 Run Receipt 草稿 | M10-31,M11-01 | P0 | M |
| M11-17 | mcp | 实现 `validate_submission` Tool | MCP tool | 返回结构化 Finding | M10-32,M11-01 | P0 | M |
| M11-18 | mcp | 实现 `publish_submission` Tool | MCP tool | 明确确认后才签名提交 | M10-33,M11-17 | P0 | M |
| M11-19 | mcp | 实现 `submit_verification` Tool | MCP tool | 锁定 ClaimRevision | M10-35,M11-01 | P0 | M |
| M11-20 | mcp | 实现 `submit_challenge` Tool | MCP tool | 提交结构化 Challenge | M10-36,M11-01 | P1 | M |
| M11-21 | mcp | 实现 `inspect_provenance` Tool | MCP tool | 返回依赖与贡献路径 | M10-37,M11-01 | P1 | M |
| M11-22 | mcp | 实现 `verify_inclusion_proof` Tool | MCP tool | 本地验证 Event proof | M10-18,M11-01 | P1 | M |
| M11-23 | mcp | 为写 Tool 添加用户确认标记 | MCP safety | 未确认调用返回 consent_required | M11-12:M11-20 | P0 | M |
| M11-24 | mcp | 为 Tool 输出添加 JSON Schema | MCP schemas | 所有 Tool 输出可校验 | M11-10:M11-22 | P0 | M |
| M11-25 | mcp | 确认 Tool 列表无 GitHub 语义 | MCP audit | 名称和参数不含 PR/branch/commit | M11-03:M11-24 | P0 | S |
| M11-26 | release | 发布 MCP alpha | npm release | npm 可安装并有配置样例 | M11-01:M11-25 | P1 | S |

**本里程碑任务数：26**

## M12：Frontier Bundle、公共镜像与迁移

**里程碑目标：** 确保任何正式前沿可离线验证、公开镜像和重新导入。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M12-01 | export | 定义 Frontier Bundle 目录规范 | bundle spec | 目录和必需文件完整 | M1-13,M8-29 | P0 | M |
| M12-02 | export | 定义 Bundle manifest Schema | bundle schema | 文件 hash、size、role 可校验 | M12-01 | P0 | M |
| M12-03 | export | 实现 Claim revision 导出 | exporter | 指定 Frontier 的 Claim 全部导出 | M8-30,M12-01 | P0 | M |
| M12-04 | export | 实现 Evidence manifest 导出 | exporter | 引用 Evidence 均有 manifest | M6-26,M12-01 | P0 | M |
| M12-05 | export | 实现 VerificationReceipt 导出 | exporter | Frontier 依赖的 Receipt 全部导出 | M8-13,M12-01 | P0 | M |
| M12-06 | export | 实现 Contribution Graph 导出 | exporter | 贡献 produced/used 边完整 | M7-25,M12-01 | P0 | M |
| M12-07 | export | 实现 Event 区间导出 | exporter | 包含 Frontier 依赖的 Event NDJSON | M7-07,M12-01 | P1 | M |
| M12-08 | export | 实现 checkpoint 与 proof 导出 | exporter | Bundle 含可验证 root 和 proof | M7-17:M7-20,M12-01 | P1 | M |
| M12-09 | export | 实现 checksums.txt 生成 | exporter | 所有文件均有 SHA-256 | M12-02:M12-08 | P0 | S |
| M12-10 | export | 实现 report.md 生成 | exporter | 报告列出 accepted/contested/open blockers | M8-29,M12-01 | P1 | M |
| M12-11 | export | 实现 ZIP Bundle 生成 | export worker | 可下载 zip 且 manifest 验证通过 | M12-02:M12-10 | P0 | M |
| M12-12 | export | 实现 Bundle 离线验证库 | validator | 断网环境可验证 hash 与签名 | M12-11,M7-30 | P0 | M |
| M12-13 | export | 实现 Bundle 导入预检 | importer | 不写数据库即可输出冲突报告 | M12-02,M12-12 | P1 | M |
| M12-14 | export | 实现 Bundle 导入命令 | importer | 空实例可导入示例 Frontier | M12-13 | P1 | M |
| M12-15 | mirror | 创建公共镜像仓库 | GitHub repository | 仓库可访问 | M0-06 | P1 | XS |
| M12-16 | mirror | 创建 GitHub Release 发布 Token | secret config | Token 仅在 Worker 环境 | M12-15 | P1 | S |
| M12-17 | mirror | 实现 GitHub Release 创建 | mirror worker | Frontier 发布后创建对应 Release | M12-11,M12-16 | P1 | M |
| M12-18 | mirror | 实现 Release Asset 上传 | mirror worker | Bundle 成功上传 | M12-17 | P1 | M |
| M12-19 | mirror | 实现镜像 Receipt 保存 | domain service | 保存 release URL、asset hash、时间 | M12-18,M3-53 | P1 | M |
| M12-20 | mirror | 实现镜像失败重试 | worker job | 失败进入 Outbox 重试 | M12-17,M7-11 | P1 | M |
| M12-21 | mirror | 实现第二存储镜像 Adapter 接口 | adapter interface | 可注册第二实现 | M12-19 | P2 | M |
| M12-22 | timestamp | 实现 OpenTimestamps Adapter 接口 | adapter interface | 可提交 checkpoint root | M7-17 | P2 | M |
| M12-23 | timestamp | 实现 OTS proof 保存 | domain service | proof 可随 Bundle 导出 | M12-22,M12-08 | P2 | M |
| M12-24 | witness | 定义 Witness checkpoint 格式 | witness spec | 第三方可签署同一 root | M7-17 | P2 | M |
| M12-25 | witness | 实现 Witness Receipt 导入 | API endpoint | 有效第三方签名可保存 | M12-24 | P2 | M |
| M12-26 | test | 创建主站消失恢复演练 | DR test | 仅用 Bundle 在空实例恢复 Frontier | M12-14 | P1 | M |

**本里程碑任务数：26**

## M13：安全、可观测性、备份与运维

**里程碑目标：** 达到可公开 Alpha 的最低安全与恢复能力。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M13-01 | security | 建立威胁模型 | threat model | 覆盖身份、API、R2、Prompt Injection、恶意文件 | M0-17 | P0 | M |
| M13-02 | security | 建立风险等级判定表 | risk policy | open/moderated/restricted/prohibited 有例子 | M13-01 | P0 | M |
| M13-03 | security | 实现高风险 Question 阻断 | domain guard | restricted/prohibited 不自动公开 | M13-02,M5-13 | P0 | M |
| M13-04 | security | 实现上传文件扩展名策略 | validation | 禁止类型被拒绝 | M6-04,M13-01 | P0 | S |
| M13-05 | security | 实现上传文件大小配额 | quota guard | 超配额返回固定错误码 | M6-04 | P0 | M |
| M13-06 | security | 实现 Actor 请求限流 | rate limit | 超过阈值返回 429 | M5-01,M4-06 | P0 | M |
| M13-07 | security | 实现 API Token 请求限流 | rate limit | 每 token 独立计数 | M13-06,M4-17 | P1 | S |
| M13-08 | security | 实现提交重放检测 | security guard | 相同签名 nonce 重放失败 | M4-13,M5-08 | P0 | M |
| M13-09 | security | 实现 CSRF 防护 | web security | Cookie 写请求无有效 token 失败 | M9-08 | P0 | M |
| M13-10 | security | 配置安全响应头 | web config | CSP/HSTS/X-Content-Type-Options 生效 | M9-01 | P0 | S |
| M13-11 | security | 实现 Prompt Injection 来源标签 | context metadata | 外部 Artifact 明确标记 untrusted_content | M8-01:M8-04 | P0 | M |
| M13-12 | security | 实现 MCP Tool 最小 scope | MCP guard | 超 scope Tool 返回 403 | M11-18:M11-20,M4-18 | P0 | M |
| M13-13 | security | 扫描依赖漏洞 | CI job | 高危漏洞使 CI 失败 | M0-21 | P1 | S |
| M13-14 | security | 固定 GitHub Actions 版本 | CI config | 第三方 Action 固定到 commit SHA | M0-21 | P1 | M |
| M13-15 | security | 配置 Dependabot | repository config | 每周创建依赖更新 PR | M0-07 | P1 | XS |
| M13-16 | observability | 接入结构化 API 错误监控 | monitoring | 未处理异常进入告警系统 | M5-04 | P0 | M |
| M13-17 | observability | 接入 Web 错误监控 | monitoring | 客户端异常包含 release 和 request_id | M9-06 | P1 | M |
| M13-18 | observability | 建立 API 延迟指标 | metrics | P50/P95/P99 可查看 | M5-01 | P1 | M |
| M13-19 | observability | 建立数据库慢查询监控 | dashboard | 慢查询可定位到 query name | M3-01 | P1 | M |
| M13-20 | observability | 建立 Outbox 积压指标 | metrics | 待处理数量和最老任务年龄可查看 | M7-08 | P0 | M |
| M13-21 | observability | 建立上传失败指标 | metrics | 按失败原因统计 | M6-04:M6-09 | P1 | M |
| M13-22 | observability | 建立 Policy 失败指标 | metrics | 按 rule code 统计 | M8-22 | P1 | S |
| M13-23 | observability | 建立 Mirror 失败指标 | metrics | 按 provider 统计 | M12-20 | P1 | S |
| M13-24 | backup | 配置托管 PostgreSQL 自动备份 | backup config | 后台显示备份成功 | M2-01 | P0 | S |
| M13-25 | backup | 实现每日逻辑导出 | backup job | 生成加密 dump | M3-01 | P1 | M |
| M13-26 | backup | 配置备份异地保存 | backup storage | dump 不与主 DB 同 provider 单点 | M13-25 | P1 | M |
| M13-27 | backup | 实现 R2 Artifact Manifest 清单 | inventory job | 每日输出对象 key/size/hash | M2-04,M6-11 | P1 | M |
| M13-28 | backup | 执行数据库恢复演练 | restore report | 新实例恢复并通过核心查询 | M13-25:M13-26 | P0 | M |
| M13-29 | backup | 执行 Artifact 恢复抽样 | restore report | 随机 20 个 Artifact hash 均匹配 | M13-27 | P1 | M |
| M13-30 | ops | 编写生产发布 Runbook | runbook | 包含迁移、回滚、健康检查 | M2-09,M3-69 | P0 | M |
| M13-31 | ops | 编写密钥泄漏 Runbook | runbook | 包含撤销、轮换和审计步骤 | M7-29 | P0 | M |
| M13-32 | ops | 编写数据库故障 Runbook | runbook | 包含只读降级和恢复步骤 | M13-28 | P1 | M |
| M13-33 | ops | 配置成本预算告警 | billing alert | 达到预算阈值时通知 | M2-01:M2-11 | P1 | S |
| M13-34 | ops | 配置状态页 | status page | Web/API/DB/Storage 状态可见 | M2-22 | P2 | M |
| M13-35 | test | 执行权限越权测试 | security test | 跨 Actor 读取受限对象失败 | M4-28,M13-03 | P0 | M |
| M13-36 | test | 执行上传恶意样例测试 | security test | 阻断文件不进入正式 Artifact | M6-17,M13-04 | P0 | M |

**本里程碑任务数：36**

## M14：首个科研闭环与验收

**里程碑目标：** 用真实科研问题证明系统能够推进、验证、挑战、合并和继续。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M14-01 | pilot | 选择计算科研 Pilot 问题 | Pilot brief | 范围、许可、数据与负责人明确 | M1-08,M13-02 | P0 | M |
| M14-02 | pilot | 编写 Pilot ResearchContract | Contract revision | 通过 Question Schema | M14-01,M1-29 | P0 | M |
| M14-03 | pilot | 创建 Pilot Project | Project object | Web 可访问 Project | M14-02,M5-09 | P0 | S |
| M14-04 | pilot | 创建 Pilot Question | Question object | 状态为 admissible | M14-02,M5-13 | P0 | S |
| M14-05 | pilot | 拆解第一个 Task | Task object | 单一输入输出和验收标准 | M14-04,M5-18 | P0 | S |
| M14-06 | pilot | 拆解第二个 Task | Task object | 单一输入输出和验收标准 | M14-04,M5-18 | P0 | S |
| M14-07 | pilot | 拆解第三个 Task | Task object | 单一输入输出和验收标准 | M14-04,M5-18 | P0 | S |
| M14-08 | pilot | 拆解第四个 Task | Task object | 单一输入输出和验收标准 | M14-04,M5-18 | P0 | S |
| M14-09 | pilot | 拆解第五个 Task | Task object | 单一输入输出和验收标准 | M14-04,M5-18 | P0 | S |
| M14-10 | pilot | 拆解第六个 Task | Task object | 单一输入输出和验收标准 | M14-04,M5-18 | P0 | S |
| M14-11 | pilot | 拆解第七个 Task | Task object | 单一输入输出和验收标准 | M14-04,M5-18 | P0 | S |
| M14-12 | pilot | 拆解第八个 Task | Task object | 单一输入输出和验收标准 | M14-04,M5-18 | P0 | S |
| M14-13 | pilot | 为 Pilot 定义数值 VerificationContract | Contract revision | 包含复现、误差和盲测要求 | M14-02,M8-09 | P0 | M |
| M14-14 | pilot | 为 Pilot 定义 VerificationPolicy | Policy revision | 测试向量结果符合预期 | M14-13,M8-10,M8-36 | P0 | M |
| M14-15 | pilot | 生成 Pilot Frontier Context | ContextBundle | hash 验证通过 | M14-04,M8-01 | P0 | M |
| M14-16 | pilot | 生成 Pilot Blind Context | ContextBundle | 不包含预期结果 | M14-04,M8-04 | P0 | M |
| M14-17 | pilot | 使用 Agent A 拉取 Task | Attempt | CLI 成功创建 Attempt | M14-05,M10-28 | P0 | S |
| M14-18 | pilot | 使用 Agent A 生成 Run | Run object | 输入输出 Artifact 均固定 | M14-17,M10-31 | P0 | M |
| M14-19 | pilot | 使用 Agent A 提交 Candidate Claim | Claim revision | Schema、签名和 Event 均通过 | M14-18,M10-33 | P0 | M |
| M14-20 | pilot | 验证 Candidate Claim 页面 | Web acceptance | Claim、Run、Evidence 可导航 | M14-19,M9-32,M9-40:M9-43 | P0 | S |
| M14-21 | pilot | 创建独立验证 Task | Task object | 要求 blind 与独立实现 | M14-19,M5-18 | P0 | S |
| M14-22 | pilot | 使用 Agent B 拉取 Blind Context | Attempt | Context 不含预期输出 | M14-21,M10-27 | P0 | S |
| M14-23 | pilot | 使用 Agent B 提交 VerificationReceipt | Verification object | outcome 和 Finding 可查看 | M14-22,M10-35 | P0 | M |
| M14-24 | pilot | 使用 Agent C 拉取 Adversarial Context | Attempt | 获取反例导向 Bundle | M14-19,M8-03 | P0 | S |
| M14-25 | pilot | 使用 Agent C 提交反例搜索结果 | Verification/Challenge | 结果为 refute 或 inconclusive 且证据固定 | M14-24,M10-35:M10-36 | P0 | M |
| M14-26 | pilot | 运行 Pilot Policy evaluation | Policy result | 输出结果引用固定输入 revision | M14-23,M14-25,M8-22 | P0 | S |
| M14-27 | pilot | 创建 Pilot MergeProposal | MergeProposal | 列出满足和未满足条件 | M14-26,M8-27 | P0 | S |
| M14-28 | pilot | 发布第一个 FrontierSnapshot | Frontier object | sequence=1 且成员固定 | M14-27,M8-29 | P0 | M |
| M14-29 | pilot | 生成第一个 Frontier Bundle | Bundle | 离线验证通过 | M14-28,M12-11:M12-12 | P0 | M |
| M14-30 | pilot | 镜像第一个 Frontier 到 GitHub | GitHub Release | Asset hash 与 Bundle 一致 | M14-29,M12-17:M12-19 | P1 | M |
| M14-31 | pilot | 使用 Agent D 拉取新 Frontier Context | Attempt | Bundle 引用 Frontier 1 | M14-28,M10-27 | P0 | S |
| M14-32 | pilot | 使用 Agent D 创建下一步 Claim | Claim revision | derived_from 引用 Frontier 1 | M14-31,M10-33 | P0 | M |
| M14-33 | pilot | 执行上游 contested 污染测试 | E2E test | 下游 Claim 被 dependency_tainted | M14-32,M8-37 | P0 | M |
| M14-34 | pilot | 执行 Event 投影重建 | E2E test | 重建后 Pilot 状态一致 | M14-28,M7-26 | P0 | M |
| M14-35 | pilot | 执行主站消失恢复测试 | E2E test | 仅凭 Bundle 恢复 Frontier 1 | M14-29,M12-26 | P0 | M |
| M14-36 | pilot | 完成无 GitHub 用户测试 | UX report | 测试者从 Web 完成提问和 Challenge | M9-24,M9-46 | P0 | M |
| M14-37 | pilot | 完成异构 Agent 接入测试 | integration report | 至少 CLI 与 MCP 两种入口成功 | M14-19,M14-23,M11-26 | P0 | M |
| M14-38 | pilot | 编写 Pilot 复盘 | retrospective | 列出阻塞、冗余字段和 v0.4 变更建议 | M14-01:M14-37 | P1 | M |

**本里程碑任务数：38**

## M15：文档、社区与公开 Alpha

**里程碑目标：** 让外部开发者、研究者和 Agent 能够理解、接入和参与。

| ID | Area | 原子任务 | 单一交付物 | 验收标准 | 依赖 | Priority | Size |
|---|---|---|---|---|---|---|---|
| M15-01 | docs | 编写项目 README | README.md | 两分钟内可理解使命、入口和非目标 | M0-01:M0-05 | P0 | M |
| M15-02 | docs | 编写 Web 用户 Quickstart | guide | 新用户 10 分钟可提交 Question 草稿 | M9-24 | P0 | M |
| M15-03 | docs | 编写 CLI Quickstart | guide | 新用户 15 分钟可拉取 Task | M10-41 | P0 | M |
| M15-04 | docs | 编写 MCP Quickstart | guide | 一个 Host 可配置 MCP Server | M11-26 | P0 | M |
| M15-05 | docs | 编写 Claim 写作指南 | guide | 包含好坏 Claim 对照样例 | M1-11,M1-31 | P0 | M |
| M15-06 | docs | 编写 Evidence 固定指南 | guide | 包含 R2、外部 URL、hash 和 license | M6-01:M6-29 | P0 | M |
| M15-07 | docs | 编写 Run Receipt 指南 | guide | 包含 OCI digest 和随机种子 | M6-18:M6-23 | P1 | M |
| M15-08 | docs | 编写独立验证指南 | guide | 解释 Blind、独立性和 inconclusive | M8-11:M8-15 | P0 | M |
| M15-09 | docs | 编写 Challenge 指南 | guide | 解释有效反例与影响 | M5-41:M5-43 | P1 | M |
| M15-10 | docs | 编写 Frontier 与 Policy 指南 | guide | 解释 accepted under policy | M8-16:M8-34 | P0 | M |
| M15-11 | docs | 编写贡献溯源指南 | guide | 解释角色、produced、used 和负结果 | M7-21:M7-25 | P1 | M |
| M15-12 | docs | 编写安全研究政策 | policy | 高风险类别和处理流程明确 | M13-01:M13-03 | P0 | M |
| M15-13 | docs | 编写隐私政策 | policy | 列出收集数据、保留期和用户权利 | M4-01,M13-01 | P0 | M |
| M15-14 | docs | 编写服务条款草案 | policy | 明确科研内容责任和禁止用途 | M15-12,M15-13 | P1 | M |
| M15-15 | docs | 生成 API 文档站 | docs site | OpenAPI 可浏览和下载 | M5-45 | P1 | M |
| M15-16 | docs | 发布协议 Schema 文档 | docs site | 每个 Schema 有字段说明和样例 | M1-27:M1-40 | P0 | M |
| M15-17 | docs | 发布数据库迁移文档 | docs | 可从 Supabase 恢复到本地 PostgreSQL | M13-28 | P1 | M |
| M15-18 | docs | 发布自托管参考部署文档 | docs | Docker Compose 可完成最小启动 | M2-18:M2-21 | P1 | M |
| M15-19 | community | 创建 good-first-task 标签规则 | community guide | 符合规则的任务可被自动检查 | M14-05:M14-12 | P1 | S |
| M15-20 | community | 创建公开项目提案模板 | Web template | 提案字段与 ResearchContract 对齐 | M9-19:M9-24 | P1 | M |
| M15-21 | community | 创建 Blind Verification 活动模板 | event template | 包含任务、时间、提交和复盘格式 | M14-23 | P1 | M |
| M15-22 | community | 创建贡献分享卡片 | Web component | 可生成 Claim/Verification 分享图 | M9-50 | P2 | M |
| M15-23 | release | 冻结 v0.3 Schema | version tag | Schema 标记 0.3.0 | M1-40,M14-38 | P0 | S |
| M15-24 | release | 发布数据库迁移 v0.3 | migration release | 生产环境迁移成功 | M3-70,M15-23 | P0 | M |
| M15-25 | release | 发布 Web Alpha | deployment | 生产域名可访问 | M9-01:M9-56,M15-24 | P0 | M |
| M15-26 | release | 发布 API Alpha | deployment | 生产健康检查和 OpenAPI 可访问 | M5-01:M5-46,M15-24 | P0 | M |
| M15-27 | release | 发布 CLI Alpha | npm release | 公开 npm 包可安装 | M10-41 | P0 | S |
| M15-28 | release | 发布 MCP Alpha | npm release | 公开 npm 包可安装 | M11-26 | P0 | S |
| M15-29 | release | 发布第一个公开 Frontier | public artifact | Web 与 GitHub Release 均可访问 | M14-29:M14-30 | P0 | M |
| M15-30 | release | 创建 Alpha 反馈入口 | feedback form | 反馈可关联页面和 request_id | M15-25:M15-29 | P1 | S |
| M15-31 | release | 创建 Alpha 发布公告 | announcement | 包含参与入口、限制和 Pilot 链接 | M15-25:M15-30 | P1 | M |

**本里程碑任务数：31**

---

## 2. 总任务统计

- 总原子任务数：**582**
- 任务规模仅包含 XS / S / M；
- 不存在 L 或“整模块一次完成”的任务；
- 实施时应按依赖图推进，而不是按表格从上到下机械执行。

## 3. MVP 最短关键路径

以下里程碑构成第一条可运行闭环：

```text
M0 项目基础
→ M1 协议与 Schema
→ M2 托管环境
→ M3 核心数据库
→ M4 身份
→ M5 Domain API
→ M6 Evidence / Run
→ M7 ResearchEvent
→ M8 Verification / Frontier
→ M9 Web 最小页面
→ M10 CLI 最小命令
→ M11 MCP 最小 Resources/Tools
→ M12 Frontier Bundle
→ M14 Pilot 闭环
```

M13 和 M15 中的 P0 项必须在公开 Alpha 之前完成。

## 4. 公开 Alpha 出口条件

只有同时满足以下条件才可以标记 Alpha：

1. Web 用户无需 GitHub 即可提出问题、提交 Claim、Verification 和 Challenge；
2. CLI 与 MCP 都能读取 Task 和提交正式对象；
3. PostgreSQL revision 不可覆盖；
4. ResearchEvent 不可被普通应用角色修改或删除；
5. Evidence 直传后执行 hash 验证；
6. VerificationReceipt 锁定具体 ClaimRevision；
7. Policy Engine 能产生可解释结果；
8. FrontierSnapshot 不可变；
9. Frontier Bundle 可离线验证；
10. GitHub Release 镜像 hash 与主 Bundle 一致；
11. Pilot 完成 Agent A 提交、Agent B 盲复现、Agent C 挑战、Agent D 继续推进；
12. 数据库恢复、投影重建和主站消失恢复测试通过；
13. P0 安全测试通过；
14. 项目计划书、用户指南、CLI/MCP Quickstart 和安全政策已发布。
