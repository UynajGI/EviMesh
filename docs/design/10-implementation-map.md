# 10 · 落地映射：从设计书到 apps/web

> 本章把设计书映射到现有代码（`apps/web`），给出不破坏现有测试与部署边界的分期路线。
> 原则：设计书是视觉与内容契约的事实源；实现仍走 M13.7 的 Primer 适配层 ADR（A06），不引入第二套组件系统。

## 1. Token 层迁移

| 设计书（docs/design/html/assets/tokens.css） | 现状（apps/web/app/globals.css） | 迁移动作 |
|---|---|---|
| `--evimesh-p-*` 三层 primitive | 无（直接语义层） | 新增 primitive 层，语义层改为引用 |
| 状态双档（`-bg/-fg/-border` + emphasis） | 单档 `--evimesh-{status}` | 扩展为双档 + emphasis；`test/token-contrast` 增加双档对 |
| `[data-theme]` 手动切换 + 双 dark 块 | 仅 `prefers-color-scheme` | 引入 theme.js 模式与无闪烁内联片段 |
| DAG 边五族 token | 无 | 新增，服务 C11 科研图谱 |
| 系列 8 色（数据可视化） | 无 | 新增，图表用（计数不评分的场景） |

注意：现有 oklch 值与设计书 hex 值的换算以对比度测试为准（两套都过 AA）；落地时**保留 globals.css 的 oklch 表达**、以设计书 hex 为对照校验值，避免无谓的格式迁移 diff。

## 2. 组件层映射

| 设计书 class（app.css） | 对应现有组件 | 动作 |
|---|---|---|
| `.gheader/.gnav` | M13.5 shell | 对齐任务型导航（Home/Explore/Work/Agent/Docs），迁移现有对象路由为 Explore 筛选维度 |
| `.badge--*` 双层 | Badge 六态 | 扩展协议状态全集（Claim 10 态、Finding 4 级、outcome、change 4 级、role 6 类），文本先行 |
| `.idchip` | Metadata 原语 | 新增：mono 值 + 截断 + 复制 |
| `.attr/.attr__via` | 无 | 新增：人类与 agent 归属链（R10 透明性） |
| `.changeitem` | 首页卡片 | 重构 Home 为四级变化流（M13.6-A07 文案） |
| `.stepper` | 向导步骤 | Agent Center 使用 |
| `.dialog/.scrim` | Radix Dialog（B08） | 保持 Radix 实现负责焦点；设计书样式对齐 |
| `.dag/.dag-legend` | C11 科研图谱 | 布局引擎按 A02 选型：d3-dag Sugiyama + 自绘 SVG/React Flow 交互 + 列表等价视图 |
| `.rolebar/.timeline` | Trust 页事件流 | 归并为贡献记录与事件流通用件 |
| `.tabs` | Project 工作区 tab | 语义化为 URL 可寻址视角（aria 模式不变） |
| `.prose-research/.claim-statement` | 无 | 新增 serif 阅读模式（scoped） |

## 3. 页面路由映射

| 设计书页面 | 生产路由 | 现状 |
|---|---|---|
| landing.html | `/`（匿名态） | 现首页为空数据框，需按 05 规格重写 |
| home.html | `/`（登录态）或 `/home` | 新增 watchlist 变化流（依赖 M13.6-E 投影） |
| explore.html | `/explore` | 新增；`/projects` `/questions` `/claims` 保留为筛选参数或重定向 |
| work.html | `/work` | 新增（聚合 tasks/verification/challenges/drafts） |
| workspace.html | `/questions/[id]`（六视角 tab） | 现六 tab 结构可复用，按 05 规格重排内容 |
| claim.html | `/claims/[id]` | 现有 detail/diff/DAG 增强：serif statement、状态摘要栏、图/列表切换已有雏形 |
| profile.html | `/people/[handle]` | 新增公开研究者主页 |
| settings.html | `/settings/*` | 现有 tokens 页并入五分区 |
| agent-center.html | `/agent` | 现有 `/agent` 骨架按六步向导重构 |
| agent-activity.html | `/agents/[id]` 与 `/attempts/[id]` | 新增 |
| handoff.html | 全局 sheet（任意对象页触发） | 新增（M13.6 3.3） |
| notifications.html | `/notifications` | 新增 |
| command-palette.html | 全局 overlay | 新增（搜索框 `Ctrl+K`） |
| states.html | 非路由 | 各页实现四态（08 章矩阵） |

## 4. 分期路线（对齐 M13.7 交付 DAG）

1. **P1 基础（随 M13.7-C）**：token 三层 + 双档 + 手动主题；gheader 任务型导航；badge 协议全集；idchip；states 四态铺开。**已落地（PR #58）。**
2. **P2 阅读主径（随 M13.6-E / M13.7-E）**：workspace 六视角、claim 详情（serif/DAG 列表切换/状态摘要）、explore、landing 重写。**已落地（PR #58 + #59）。**
3. **P3 Agent 闭环（随 M13.7-D）**：agent-center 向导、agent-activity、handoff sheet、归属链全站铺开。**已落地（PR #58 + #59）。**
4. **P4 个人与社区（随 M13.7-B/E）**：profile、settings 五分区、notifications、command-palette。**已落地（PR #58 + #59）。**
5. **P5 增量**：07 章「未来界面候选」按需补规格。

### 4.1 视觉保真度追加轮（PR #59，2026-08-19）

PR #59 在 P1-P4 骨架之上按设计稿逐区块补齐视觉层：Home 变化流（critical/quiet 组 + 级别着色计数徽标 + 上下文栏）、Landing 真实示例卡（证据分组计数 + 归属链）、Explore 排序侧栏 + tab 计数 + 标题 hydrate、Work 五 tab + 角色分布 + 行级 handoff、workspace serif 阅读态 + revision 钉住链接 + frontier 导出、claim 页头重构（serif 陈述 + Frontier 徽标 + 事件 hash）+ 内联 revision diff + 可导航证据计数、profile 头像 hero + RoleBar + 可读列表、events 图标时间线 + 技术详情折叠、/design 目录新原语展示、DAG 栈切换为 d3-dag Sugiyama + React Flow（移除 cytoscape）、M13.6 宪章测试冻结 handoff 主动作 / 表单降为回退。

数据门控面（后端就位即可填充，UI 侧已有诚实占位）：watchlist 个性化、挑战列表 API、agent registry、ORCID OAuth、通知 reason 行。图 API 的 14 种边类型已由 `/claims/{claimId}/graph` 返回并在 DAG 与列表视图中保留。

### 4.2 全量 mockup 对照轮（PR #59，2026-08-20）

对 `docs/design/html/` 17 个设计稿逐文件结构对照后的补齐：Home 右栏「最近访问」卡（`lib/visit-history.mjs`，localStorage 本地历史，上限 8 条，question/claim/project 详情页在可读标题就绪后记录）、Explore「研究者」tab（由已加载对象的 `createdBy` 归属派生，按最近活动排序、计数仅为入口）与「近 30 天」筛选 chip、`/agent` 新增「Read with an agent」节（四视角阅读说明 + 工具目录升级为 Tool/Category/Write level 表，名称仍严格对齐 MCP 注册表）与「Security and revocation」节（最小权限/撤销/令牌卫生三卡）、研究者主页「公开贡献」签名 statements 时间线（role + description + 日期，上限 12）与「参与的项目」（produced/used 边中 objectType=project 的去重水合，上限 6）、workspace Summary 视角「Disputes and verification blocks」卡（attention 状态 claim 行 + 仅 attention claim 的回执 findings 水合，critical/major 双级，双侧有界）。

本轮确认的剩余数据门控（协议或 API 尚无对应字段，不做虚构渲染）：Explore 主题 rail（协议对象不携带学科标签）、研究者目录 beyond 派生视图（无 actor 列表端点）、agent 身份卡的 model/scope/密钥指纹字段（actors 端点仅返回贡献数据）、`/agent` 实时授权列表（web 登录态未接入）、Home「Agent 连接」卡的实时 agent 状态与待签名计数、挑战列表行（挑战仅有按 id 详情）。

### 4.3 块级对照轮（PR #59，2026-08-20 第二轮）

7 个并行审计对 17 个设计稿 + 05-09 章规格做块级（行/徽标/meta/按钮级）对照后补齐：修复 3 处崩溃级缺陷（claims 页 ReadableField 数组分支内嵌游离 useEffect；attempts/questions 页 document.title useEffect 位于条件 return 之后导致 hook 顺序违规）、命令面板补齐动作组（复制 permalink）/主题组/对象组（每类型 20 条有界实读）并实现 G 和弦导航、顶栏通知铃铛与账户 chip、handoff 对象标题行与主关闭按钮、表单 aria-invalid/aria-describedby 接线、DAG 边五族图例、claims 页论证图默认 upstream + append-only 修订列表（有界 8）+ 修订对比页入口 + 按关系可展开证据行（含 artifact/run 归属）+ 字段化回执（verificationTypes/contextMode/盲验证说明/逐条 findings）+ 侧栏 Frontier 行与最近活动、workspace 页 acceptance 行/Argument 主张陈述水合（有界 10）/任务标题水合（有界 6）/证据行归属/污染 danger alert/回执字段化、work 页验证策略 alert/blocked 任务区/验证行 question 与归属 meta/草稿卡 meta 与审阅签名 CTA、explore 可参与筛选（开放任务派生）/结果摘要行/计数说明行、home 页 requestId 贯穿/四处空态 CTA/登录范围 denied 卡/agent 卡门控文案、attempts 页身份卡（可用字段实数据 + 未暴露字段门控行 + 自报声明 alert）/公开产出（produced/used 边）/HITL 说明、contributor ORCID iD 标识（无验证徽标，硬边界）/时间线 statement id、settings iD 冲突警示/Token 表 last used 与 active-expired-revoked 状态/未登录 denied 态/空态设备授权引导/密钥轮换说明、agent 页分区锚点导航/MCP 推荐路径徽标/scope 调整入口。新增机械性防回归测试：全站 page.js 禁止 hook 出现在条件 return 之后。

本轮确认的协议级门控（不做虚构渲染，与 §4.2 一致并新增）：claim revision 的 semantic_hash/raw_hash/policy 列（DB 无此列）、任务 lease 剩余时间（列表不含 lease）、actor 类型与 agent 人类区分（actors API 不返回 actorType）、settings profile 的 affiliation/研究领域字段（profile API 不接受）、token 命名与创建时间列（API 无 name/createdAt）、活跃会话列表（无会话 API）、快照内状态列（members 仅含 revision）、最近变化排序维度（列表无 updatedAt）。

## 5. 验证门禁

- 双主题 token 对比度测试扩到全部双档对（沿用 `test/token-contrast.test.mjs` 模式）。
- 每个新页面组件配全态测试（loading/empty/error/denied），沿用现有 `test/*.test.mjs` 固化模式。
- DAG 图必须随附键盘可达列表等价视图测试（C11 约束）。
- 手动主题切换与 `prefers-color-scheme` 联动测试（含无闪烁）。
- 设计稿 HTML 本身作为视觉回归基线（390/768/1440 三档截图对比）。


### 4.4 协议/API 闭环轮（PR #59，2026-08-20 第三轮）

§4.2/§4.3 中四个「协议层门控」本轮通过 schema/API 扩展真正闭环（迁移 0076）：`questions.topics`（text[] ≤8、GIN 索引、DB CHECK + 领域层校验 + POST /questions 接受 + openapi 记录）驱动 Explore 主题 tab 与主题 rail（按字母序、计数仅入口）；`actors` 表新增 model_name/runtime/scope/public_key_fingerprint/owner_actor_id 五个可空自报字段，`GET /actors/:id` 返回身份卡行（含 actorType/identityStrength/displayName），agent 身份卡改渲染真值、空值如实显示 not stated；新增 `GET /actors` 目录端点（hosted 仓库扩展 actors/actor_profiles/contribution_statements/contribution_edges 四表读取，事实表跳过软删过滤），Explore 研究者 tab 以目录为准、派生计数为补充，旧部署自动回退派生视图；`/agent` Security 节接入登录会话实时拉取 /api-tokens 渲染授权行（scope、最近使用、调整 scope 入口、行内撤销），未登录保持诚实提示。附带修复：hosted 仓库此前未实现 listContributionStatements/listContributionEdges，/actors/:id 在生产会 500——本轮一并接通；无贡献 statements 但有 actor 行的作者不再 404。

此前「渲染出来只能是编造数据」的判断对当时 API 成立；本轮把 API 补上后数据即为真实。写入侧：topics 随 POST /questions 与 frontier bundle prerequisites.questions 行透传；身份卡字段由 actor 所有者在 provision 时记录（hosted 通过 bundle prerequisites.actors 行携带）。

### 4.5 Home 发现流改版（业主指示，2026-08-21）

首页从四级变化流改为推荐式发现流（小红书/B站/头条之形、非其核）：瀑布流卡片网格（question/claim/frontier 三类卡）、话题 chip 筛选（复用 questions.topics）、游标 Load more、Needs attention 横条保留注意级语义、右侧个人栏（My work / 登录范围 / Agent 连接 / 最近访问 / 事件审计）。硬边界不变：唯一排序是时间（最新在前），计数只作入口，无热度/互动/相关性评分——home.html 变化流布局由此 supersede。
### 4.6 个人导航信号 + 离线协同过滤（业主指示，2026-08-21）

按业主「点赞收藏 + 协同过滤、算法必须用开源库」的方向落地全栈（业主在 JS 单机库与 Python 离线批训两条路线中拍板后者）：

- **信号层**（迁移 0077）：`engagement_interactions`（actor × object × kind，kind = helpful/favorite/watch/view，唯一索引防重复）；信号是私有导航输入——任何界面永不渲染公开计数。
- **采集**：api-edge 新增 `PUT/DELETE /interactions/:objectType/:objectId`、`GET /interactions/mine`（Supabase JWT 认证；写路径为 api-edge 转发客户端 token 调 PostgREST，RLS 按 identities 绑定钉死行归属，actors.auth_subject 部分唯一索引防身份劫持）；web 端卡片心形 Useful / Bookmark Save（aria-pressed、乐观切换）、详情页 view 信号（每会话一次）、`/saved` 个人收藏页、403 未开通时自动走 `POST /actors/self` 幂等自开通（补齐了生产此前缺失的用户→actor 绑定路径）。
- **推荐引擎**：`packages/recommender-training/train.py` 用开源库 implicit 的 ItemItemRecommender（item-item kNN，权重 helpful 5 / favorite 4 / watch 2.5 / view 1；零分填充截断、已交互项双保险过滤、理由行取候选项自身 KNN 行），整表原子替换 `recommendation_cache`。GitHub Actions 每小时批训（`.github/workflows/recommender-training.yml`），生产运行时零 Python；api-edge `GET /recommendations` 只读本 actor 缓存行（无分数出域）。
- **界面边界**：Home「For you」独立标注区（"From your activity · navigation, not a rating"），不参与主信息流排序（时间序不变）；RLS 同时收紧了 identities（匿名不可读）与 actors 目录（匿名只读 + 插入钉 subject）。
