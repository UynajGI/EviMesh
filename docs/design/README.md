# EviMesh UI 设计书（M13.8）

> 生成日期：2026-08-19。核心命题：**agent 主导的类 UGC 科研社区** 的完整界面设计。
> 本目录是 UI 视觉与内容契约的事实源。设计语言延续 M13.5「安静、研究优先」，产品壳遵循 M13.6/M13.7 的 agent-first 与任务型导航契约，并按用户的 `design-taste-frontend` 与 `minimalist-ui` 两份设计协议调和而成（调和记录见 01 章）。

> **v2.1 覆盖说明（2026-08-30）**：全站 Kinetic Journal 裁决以 [12-kinetic-journal-v2.1.md](12-kinetic-journal-v2.1.md) 为最新事实源；它覆盖本书较早的 dashboard/card、Claim-only graph、Graph/List tab、Phosphor 与可写研究网页描述。保留下列章节作为协议语义与历史设计依据。

## 如何查看 HTML 设计稿

全部设计稿在 [`html/`](html/) 目录，**零构建、零网络依赖**，直接用浏览器打开即可（file:// 或任意静态服务器）。每页支持浅色/深色双主题（右上角切换，跟随系统默认）。

入口：[`html/index.html`](html/index.html)（设计书封面与全部页面导航）。

v2.1 可直接打开的全站原型位于 [`../../output/evimesh-v2.1-kinetic-journal/index.html`](../../output/evimesh-v2.1-kinetic-journal/index.html)，包含 Home / Explore / Question-Answer detail / Work / Tools / Contribution Atlas / Agent demo views。

## 文档结构

| 文件 | 内容 |
|---|---|
| [00-research-findings.md](00-research-findings.md) | 深度调研：Primer/Radix/shadcn、arXiv/OpenReview/HF/Zenodo、GitHub 社区壳、DAG 库选型、MCP/agent UI 模式、无 gamification 社区、数据排版与 WCAG（含来源索引） |
| [01-design-foundations.md](01-design-foundations.md) | 六条设计原则、Design Read 与三 dial、与两份用户设计协议的调和、四个开放问题的决策 |
| [02-color-language.md](02-color-language.md) | 三层 token（primitive→semantic→component）、状态双档、协议语义色映射（Claim 状态、Evidence 关系、Finding、变化分级、DAG 14 边）、对比度自检表 |
| [03-typography-iconography.md](03-typography-iconography.md) | sans/mono/serif 三栈、字号阶梯、tabular-nums、长 ID 截断、Phosphor 图标规范 |
| [04-layout-density-motion.md](04-layout-density-motion.md) | 栅格、页面模板、密度、动效清单与 reduced-motion 降级 |
| [05-core-ui-spec.md](05-core-ui-spec.md) | 核心界面内容契约：Landing / Home / Explore / Work / 研究工作区 / 主张详情 |
| [06-personal-ui-spec.md](06-personal-ui-spec.md) | 个人界面：公开研究者主页 / Account Settings / Agent 接入中心 |
| [07-emerging-ui-spec.md](07-emerging-ui-spec.md) | 尚未出现的界面：handoff sheet / agent 活动轨迹 / 通知中心 / 命令面板 / 全状态 / 未来候选 |
| [08-states-accessibility.md](08-states-accessibility.md) | 全状态矩阵、WCAG 2.2 检查单、响应式断点 |
| [09-component-inventory.md](09-component-inventory.md) | 组件清单、class 命名约定、开源基线映射 |
| [10-implementation-map.md](10-implementation-map.md) | 与 `apps/web` 的映射与分期落地路线 |
| [11-revision-decisions.md](11-revision-decisions.md) | 已锁定裁决及 v2.1 Kinetic Journal 覆盖关系 |
| [12-kinetic-journal-v2.1.md](12-kinetic-journal-v2.1.md) | v2.1 全站视觉、异构邻域、只读网页与验收契约 |

## HTML 设计稿清单（16 页 + 资产）

| 页面 | 文件 | 一句话 |
|---|---|---|
| 设计书封面 | `html/index.html` | 原则、页面目录、文档地图 |
| 颜色语言 | `html/tokens.html` | 全 token 色板、双主题、对比度标注 |
| 组件指南 | `html/styleguide.html` | 按钮/徽标/卡片/表单/反馈/DAG/排版全变体 |
| 匿名 Landing | `html/landing.html` | 一句话定位 + 真实示例 + 信任机制 |
| 登录后 Home | `html/home.html` | watchlist 四级变化流 |
| Explore | `html/explore.html` | 统一搜索与筛选 |
| Work | `html/work.html` | 任务/验证/质疑/草稿/贡献 |
| 研究工作区 | `html/workspace.html` | 六视角（Summary→Activity） |
| 主张详情 | `html/claim.html` | serif 陈述 + DAG 图/列表 + revision diff |
| 研究者主页 | `html/profile.html` | ORCID 已验证 + 角色贡献 + 她的 Agent |
| 账户设置 | `html/settings.html` | 身份/Token/安全/通知五分区 |
| Agent 接入中心 | `html/agent-center.html` | 六步连接向导 + 工具目录 |
| Agent 活动轨迹 | `html/agent-activity.html` | attempt 时间线 + human-in-the-loop |
| Handoff sheet | `html/handoff.html` | 写交接对话框（零凭据） |
| 通知中心 | `html/notifications.html` | 订阅驱动收件箱 |
| 命令面板 | `html/command-palette.html` | 键盘统一入口 |
| 全状态规格 | `html/states.html` | loading/empty/error/denied/offline/partial |

共享资产（`html/assets/`）：`tokens.css`（三层 token）、`app.css`（组件库）、`theme.js`（主题切换）、`app.js`（复制/tabs/对话框行为）、`icons-sprite.html`（Phosphor 106 symbol 母版，构建时内联到各页）。

## 硬约束速查（违反即返工）

- 无真相分/支持度百分比/点赞/排行榜/热度排序。
- Claim 关系是 14 种有向边构成的 DAG，禁止渲染成父子树；图必须配键盘可达列表等价视图。
- 变化等级（critical/attention/update/quiet）只表示注意优先级；critical 文案遵循 M13.6-A07 句式。
- ORCID 只经 OAuth 显示已验证；生产使用官方 iD 图标与完整 URL。
- Agent 永远带归属链（代表谁、模型 self_declared、scope、密钥指纹），不伪装人类。
- handoff 与示例配置零凭据；Token 明文一次性。
- 双主题 WCAG 2.2 AA（4.5:1）；焦点环 2px；触控目标 44px；reduced-motion 全降级。
- 可见文案禁 em-dash 与 emoji；图标只用 Phosphor 一族。
