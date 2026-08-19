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

1. **P1 基础（随 M13.7-C）**：token 三层 + 双档 + 手动主题；gheader 任务型导航；badge 协议全集；idchip；states 四态铺开。
2. **P2 阅读主径（随 M13.6-E / M13.7-E）**：workspace 六视角、claim 详情（serif/DAG 列表切换/状态摘要）、explore、landing 重写。
3. **P3 Agent 闭环（随 M13.7-D）**：agent-center 向导、agent-activity、handoff sheet、归属链全站铺开。
4. **P4 个人与社区（随 M13.7-B/E）**：profile、settings 五分区、notifications、command-palette。
5. **P5 增量**：07 章「未来界面候选」按需补规格。

## 5. 验证门禁

- 双主题 token 对比度测试扩到全部双档对（沿用 `test/token-contrast.test.mjs` 模式）。
- 每个新页面组件配全态测试（loading/empty/error/denied），沿用现有 `test/*.test.mjs` 固化模式。
- DAG 图必须随附键盘可达列表等价视图测试（C11 约束）。
- 手动主题切换与 `prefers-color-scheme` 联动测试（含无闪烁）。
- 设计稿 HTML 本身作为视觉回归基线（390/768/1440 三档截图对比）。
